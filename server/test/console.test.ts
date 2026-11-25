// Console routes: sessions, runs, stream, rename, delete and uploads, all
// behind the Settings-only POST guard. The agent never runs: a fake spawner
// answers with scripted stream-json lines and records the exact argv.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setSpawner, type ActiveSpawn, type SpawnOpts } from "../agents/spawn.js";
import { createDesign, listDesigns } from "../store.js";
import { newSession, sessionsDir } from "../sessions.js";
import { createDesignTool } from "../mcp/tools/designs.js";
import { liveServer, useTempDesigns, tinyPng, multipart, type Client, type Res } from "./helpers.js";

useTempDesigns("console");
delete process.env.BLUM_CONSOLE_FAKE;
after(() => setSpawner(null));

const DANGEROUS = `draw & | > "quote" ^caret^ %PATH%`;

interface Seen {
  program: string;
  args: string[];
}

// A scripted run: emits lines, then ends. Never ends when holdOpen is set.
function scripted(lines: string[], seen: Seen[], holdOpen = false): (program: string, args: string[], opts: SpawnOpts) => ActiveSpawn {
  return (program, args, opts) => {
    seen.push({ program, args });
    let stopped = false;
    const done = new Promise<{ status: number | null; missing: boolean; timedOut: boolean; killed: boolean }>((resolve) => {
      let i = 0;
      const timer = setInterval(() => {
        if (stopped) {
          clearInterval(timer);
          resolve({ status: null, missing: false, timedOut: false, killed: true });
          return;
        }
        if (i >= lines.length) {
          if (holdOpen) return;
          clearInterval(timer);
          resolve({ status: 0, missing: false, timedOut: false, killed: false });
          return;
        }
        opts.onLine(lines[i] as string);
        i += 1;
      }, 10);
    });
    return { done, stop: () => { stopped = true; } };
  };
}

function headers(client: Client): Record<string, string> {
  return { "X-Blum-Request": "1", origin: new URL(client.base).origin, "content-type": "application/json" };
}

async function waitIdle(client: Client, id: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 100; i++) {
    const session = (await client.get(`/api/console/sessions/${id}`)).json() as Record<string, unknown>;
    if (session.status !== "running") return session;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("run did not finish");
}

const LINES = [
  `{"type":"system","subtype":"init","session_id":"agent-1"}`,
  `{"type":"assistant","session_id":"agent-1","message":{"content":[{"type":"tool_use","name":"create_design"}]}}`,
  `{"type":"result","subtype":"success","session_id":"agent-1","result":"Done"}`,
];

test("create launches claude with the exact argv and streams the transcript", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen));
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: DANGEROUS, agent: "claude-code", format: "story" }),
    });
    assert.equal(created.status, 200);
    const id = (created.json() as { id: string }).id;
    assert.match(id, /^[A-Za-z0-9_-]+$/);
    // The prompt travels as one argv element, dangerous characters included.
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.program, "claude");
    const args = seen[0]?.args ?? [];
    const prompt = args[args.indexOf("-p") + 1] as string;
    assert.match(prompt, /never ask questions first/);
    assert.ok(prompt.endsWith(`\n\n${DANGEROUS}`));
    assert.ok(args.includes("--resume") === false);
    assert.ok(args.includes("--strict-mcp-config"));
    assert.ok(args.includes("mcp__blum-studio__*"));
    const session = await waitIdle(client, id);
    assert.equal(session.agentSessionId, "agent-1");
    const transcript = session.transcript as Array<Record<string, unknown>>;
    assert.ok(transcript.some((e) => e.tool === "create_design"));
    assert.equal(transcript[transcript.length - 1]?.kind, "done");
    // The stream replays the transcript, then ends.
    const stream = await client.raw(`/api/console/sessions/${id}/stream`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(stream.status, 200);
    const rows = stream.text.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.equal(rows[rows.length - 1]?.kind, "end");
    assert.ok(rows.some((r) => r.tool === "create_design"));
    // The list shows the session with its agent.
    const listed = (await client.get("/api/console/sessions")).json() as Array<Record<string, unknown>>;
    assert.ok(listed.some((s) => s.id === id && s.agent === "claude-code"));
  } finally {
    await client.close();
  }
});

test("a follow-up message resumes the same agent session", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen));
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(created.status, 400); // missing prompt, guard passed
    const ok = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "first", agent: "claude-code", format: "story" }),
    });
    const id = (ok.json() as { id: string }).id;
    await waitIdle(client, id);
    seen.length = 0;
    const more = await client.raw(`/api/console/sessions/${id}/message`, {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ text: "make it blue" }),
    });
    assert.equal(more.status, 200);
    await waitIdle(client, id);
    const args = seen[0]?.args ?? [];
    assert.deepEqual(args.slice(-2), ["--resume", "agent-1"]);
    const prompt = args[args.indexOf("-p") + 1] as string;
    assert.match(prompt, /never ask questions first/);
    assert.ok(prompt.endsWith("\n\nmake it blue"));
  } finally {
    await client.close();
  }
});

test("stop ends the run and a second launch is refused while one runs", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen, true));
  const client = await liveServer();
  try {
    const first = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "slow work", agent: "claude-code", format: "post" }),
    });
    assert.equal(first.status, 200);
    const id = (first.json() as { id: string }).id;
    const second = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "other", agent: "claude-code", format: "post" }),
    });
    assert.equal(second.status, 409);
    const stopped = await client.raw(`/api/console/sessions/${id}/stop`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(stopped.status, 200);
    const session = await waitIdle(client, id);
    assert.equal(session.status, "error"); // killed, not a clean exit
  } finally {
    await client.close();
  }
});

test("rename and delete validate, and delete keeps the designs", async () => {
  const seen: Seen[] = [];
  // Held open until stopped: the design below is made while the run is surely active.
  setSpawner(scripted(LINES, seen, true));
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "keep me", agent: "claude-code", format: "story" }),
    });
    const id = (created.json() as { id: string }).id;
    const renamed = await client.raw(`/api/console/sessions/${id}/rename`, {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ title: "Evening story" }),
    });
    assert.equal(renamed.status, 200);
    const bad = await client.raw(`/api/console/sessions/${id}/rename`, {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ title: "" }),
    });
    assert.equal(bad.status, 400);
    // A design the agent creates during the run belongs to the session…
    const madeId = (JSON.parse(createDesignTool("Console keepsake", "story")) as { id: string }).id;
    await client.raw(`/api/console/sessions/${id}/stop`, { method: "POST", headers: headers(client), body: "{}" });
    const session = await waitIdle(client, id);
    assert.ok((session.designIds as string[]).includes(madeId));
    // …and survives the session deletion.
    const deleted = await client.raw(`/api/console/sessions/${id}/delete`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(deleted.status, 200);
    assert.equal((await client.get(`/api/console/sessions/${id}`)).status, 404);
    assert.ok(listDesigns().some((d) => d.id === madeId));
  } finally {
    await client.close();
  }
});

test("every console POST without the guard is a 403 and launches nothing", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen));
  const client = await liveServer();
  try {
    const bare = (body: string): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal((await client.raw("/api/console/sessions", bare(JSON.stringify({ prompt: "x" })))).status, 403);
    assert.equal((await client.raw("/api/console/sessions/abc/message", bare("{}"))).status, 403);
    assert.equal((await client.raw("/api/console/sessions/abc/stop", bare("{}"))).status, 403);
    assert.equal((await client.raw("/api/console/sessions/abc/stream", bare("{}"))).status, 403);
    assert.equal((await client.raw("/api/console/sessions/abc/rename", bare("{}"))).status, 403);
    assert.equal((await client.raw("/api/console/sessions/abc/delete", bare("{}"))).status, 403);
    assert.equal((await client.raw("/api/console/uploads", { method: "POST", body: new FormData() } as RequestInit)).status, 403);
    const foreign = { "X-Blum-Request": "1", origin: "http://evil.example", "content-type": "application/json" };
    assert.equal((await client.raw("/api/console/sessions", { method: "POST", headers: foreign, body: "{}" })).status, 403);
    assert.deepEqual(seen, []);
  } finally {
    await client.close();
  }
});

test("uploads keep images and documents, refuse the rest, and reach the prompt", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen));
  const client = await liveServer();
  try {
    const { body, boundary } = multipart("file", "shot.png", tinyPng(), "image/png");
    const up = await client.raw("/api/console/uploads", {
      method: "POST",
      headers: { ...headers(client), "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    } as unknown as RequestInit);
    assert.equal(up.status, 200);
    assert.match(String((up.json() as { path: string }).path), /\.console/);
    const send = async (name: string, data: Buffer): Promise<Res> => {
      const { body: b, boundary: bd } = multipart("file", name, data, "application/octet-stream");
      return client.raw("/api/console/uploads", {
        method: "POST",
        headers: { ...headers(client), "content-type": `multipart/form-data; boundary=${bd}` },
        body: b,
      } as unknown as RequestInit);
    };
    const note = await send("brief.txt", Buffer.from("Café opening on Saturday"));
    assert.equal(note.status, 200);
    assert.equal((await send("cv.pdf", Buffer.from("%PDF-1.7\n"))).status, 200);
    assert.equal((await send("fake.pdf", Buffer.from("not a pdf"))).status, 400);
    assert.equal((await send("app.exe", Buffer.from([0x4d, 0x5a, 0, 0]))).status, 400);
    assert.equal((await send("binary.txt", Buffer.from([0x68, 0, 0x69]))).status, 400);
    // Staged paths reach the prompt; a path outside the uploads folder is dropped.
    const notePath = (note.json() as { path: string }).path;
    const imagePath = (up.json() as { path: string }).path;
    const made = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "poster", agent: "claude-code", attachments: [imagePath, notePath, "C:/Windows/win.ini"] }),
    });
    assert.equal(made.status, 200);
    const args = seen[seen.length - 1]?.args ?? [];
    const prompt = args[args.indexOf("-p") + 1] as string;
    assert.ok(prompt.includes(`import_image before using it):\n${imagePath}`));
    assert.ok(prompt.includes(`Read tool and use their content):\n${notePath}`));
    assert.ok(!prompt.includes("win.ini"));
  } finally {
    await client.close();
  }
});

test("stopping another session refuses and leaves its run alone", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen, true)); // hold the run open
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "slow work", agent: "claude-code", format: "story" }),
    });
    assert.equal(created.status, 200);
    const id = (created.json() as { id: string }).id;
    const other = newSession("Idle", "claude-code", "story");
    // Another session's stop is refused…
    const stopped = await client.raw(`/api/console/sessions/${other.id}/stop`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(stopped.status, 409);
    // …and the first run is still going.
    assert.equal(((await client.get(`/api/console/sessions/${id}`)).json() as { status: string }).status, "running");
    assert.equal(seen.length, 1);
    // Its own stop ends it.
    const own = await client.raw(`/api/console/sessions/${id}/stop`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(own.status, 200);
    await waitIdle(client, id);
    const gone = await client.raw(`/api/console/sessions/${other.id}/delete`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    assert.equal(gone.status, 200);
  } finally {
    await client.close();
  }
});

test("designs made outside the run are not claimed, agent ones are", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen, true)); // hold the run open
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "attribute me", agent: "claude-code", format: "story" }),
    });
    const id = (created.json() as { id: string }).id;
    const outsider = createDesign("Manual during run", "story");
    const agentMade = (JSON.parse(createDesignTool("Agent made", "story")) as { id: string }).id;
    const session = (await client.get(`/api/console/sessions/${id}`)).json() as { designIds: string[] };
    assert.ok(!session.designIds.includes(outsider.id), "a manual design stays out");
    assert.ok(session.designIds.includes(agentMade), "the agent design is attached");
    await client.raw(`/api/console/sessions/${id}/stop`, {
      method: "POST",
      headers: headers(client),
      body: "{}",
    });
    await waitIdle(client, id);
  } finally {
    await client.close();
  }
});

test("a torn session file is a 500, not an unknown session", async () => {
  const client = await liveServer();
  try {
    const session = newSession("Doomed", "claude-code", "story");
    fs.writeFileSync(path.join(sessionsDir(), `${session.id}.json`), "{torn", "utf-8");
    assert.equal((await client.get(`/api/console/sessions/${session.id}`)).status, 500);
    assert.equal((await client.get("/api/console/sessions/nope-123")).status, 404);
  } finally {
    await client.close();
  }
});

test("the stream replays only what the page has not shown", async () => {
  const seen: Seen[] = [];
  setSpawner(scripted(LINES, seen));
  const client = await liveServer();
  try {
    const created = await client.raw("/api/console/sessions", {
      method: "POST",
      headers: headers(client),
      body: JSON.stringify({ prompt: "stream me", agent: "claude-code", format: "story" }),
    });
    const id = (created.json() as { id: string }).id;
    await waitIdle(client, id);
    const full = (await client.get(`/api/console/sessions/${id}`)).json() as { transcript: unknown[] };
    assert.ok(full.transcript.length > 1);
    const rowsOf = async (body: string, status = 200): Promise<Array<Record<string, unknown>>> => {
      const stream = await client.raw(`/api/console/sessions/${id}/stream`, {
        method: "POST",
        headers: headers(client),
        body,
      });
      assert.equal(stream.status, status);
      if (status !== 200) return [];
      return stream.text.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    };
    const all = await rowsOf("{}");
    assert.equal(all.length, full.transcript.length + 1); // + the end marker
    assert.equal(all[all.length - 1]?.kind, "end");
    const tail = await rowsOf(JSON.stringify({ after: full.transcript.length }));
    assert.deepEqual(tail.map((r) => r.kind), ["end"]);
    const bad = await client.raw(`/api/console/sessions/${id}/stream`, {
      method: "POST",
      headers: headers(client),
      body: "{oops",
    });
    assert.equal(bad.status, 400);
  } finally {
    await client.close();
  }
});
