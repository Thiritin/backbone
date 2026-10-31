import { describe, expect, it } from "vitest";
import type { GameState } from "../src/sim/50-state";
import { MAX_FILE, treeOf } from "../src/sim/60-infra/fs";
import { parseLine, splitPaste } from "../src/sim/60-infra/shell";
import { complete, promptOf, runCommand, runLine, type Session } from "../src/sim/60-infra/terminal";
import { addNote, editNote } from "../src/sim/90-actions/docs";
import type { Call } from "../src/sim/90-actions/index";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";

const base = readyGame(3);
const fresh = (): GameState => structuredClone(base);
const server = (s: GameState): Session => ({ host: s.devices.find((d) => d.id === "dev3")!.hostname!, deviceId: "dev3" });

// Runs a line the way the Terminal does, applying each action to the state before the next command.
function sh(s: GameState, line: string, session: Session | null = null, cwd: string | null = null) {
  return runLine(() => s, ([fn, ...args]: Call) => fn(s, ...args), session, cwd, line);
}
const text = (s: GameState, line: string, session: Session | null = null, cwd: string | null = null) => sh(s, line, session, cwd).output.join("\n");

describe("the line parser", () => {
  it("splits at && and ; and reads quotes and redirections", () => {
    const segs = parseLine(`echo "a b" 'c'd > out.txt && ls -l; cat >> log x`);
    expect(segs.map((x) => x.words)).toEqual([["echo", "a b", "cd"], ["ls", "-l"], ["cat", "x"]]);
    expect(segs.map((x) => x.redirect)).toEqual([{ to: "out.txt", append: false }, null, { to: "log", append: true }]);
    expect(segs.map((x) => x.then)).toEqual(["&&", ";", null]);
  });
});

describe("files", () => {
  it("are created, listed, read, moved and removed on a server", () => {
    const s = fresh(), at = server(s);
    expect(text(s, "pwd", at)).toBe("/root");
    expect(text(s, "mkdir -p notes/old && echo 'moved db' > notes/todo && echo again >> notes/todo", at)).toBe("");
    expect(text(s, "ls notes", at)).toBe("old  todo");
    expect(text(s, "cat notes/todo", at)).toBe("moved db\nagain");
    const moved = sh(s, "cd notes && mv todo old/ && ls old", at);
    expect(moved.output).toEqual(["todo"]);
    expect(moved.cwd).toBe("/root/notes");
    expect(promptOf(at, moved.cwd)).toBe(`root@${at.host}:~/notes#`);
    expect(text(s, "cp -r old copy && rm -r old && ls", at, "/root/notes")).toBe("copy");
    expect(text(s, "cat ~/notes/copy/todo", at)).toBe("moved db\nagain");
  });

  it("answer with the errors of the real tools", () => {
    const s = fresh(), at = server(s);
    sh(s, "mkdir dir", at);
    expect(text(s, "cat nope", at)).toBe("cat: nope: No such file or directory");
    expect(text(s, "rm dir", at)).toBe("rm: cannot remove 'dir': Is a directory");
    expect(text(s, "mkdir a/b", at)).toBe("mkdir: cannot create directory 'a/b': No such file or directory");
    expect(text(s, "mv dir dir/in", at)).toBe("mv: cannot move 'dir' to a subdirectory of itself, 'dir/in'");
    expect(text(s, "cd /etc/hostname", at)).toBe("bash: cd: /etc/hostname: Not a directory");
    expect(text(s, "rm -rf /", at)).toBe("rm: it is dangerous to operate recursively on '/'");
  });

  it("stop a && chain at the first failure and go on after ;", () => {
    const s = fresh();
    expect(text(s, "cat nope && echo after")).toBe("cat: nope: No such file or directory");
    expect(text(s, "cat nope; echo after")).toBe("cat: nope: No such file or directory\nafter");
  });

  it("show the machine's release and log in the base tree", () => {
    const s = fresh(), at = server(s);
    expect(text(s, "cat /etc/hostname", at)).toBe(at.host);
    expect(text(s, "cat /etc/os-release", at)).toContain('VERSION="3.1 (sarge)"');
    expect(text(s, "ls -a /etc", at)).toBe(".  ..  apt  hostname  os-release");
    expect(text(s, "rm /etc/hostname && ls /etc", at)).toBe("apt  os-release");
    expect(s.files.dev3.paths["/etc/hostname"]).toBe(false);
  });

  it("refuse files past the size limit", () => {
    const s = fresh();
    expect(text(s, `echo ${"x".repeat(MAX_FILE)} > big`)).toBe("No space left on device");
    expect(treeOf(s, "desk")["/home/you/big"]).toBeUndefined();
  });

  it("are wiped when the server loses its data, and the next change starts over", () => {
    const s = fresh(), at = server(s);
    sh(s, "touch keep", at);
    s.hour += 1;
    s.devices = s.devices.map((d) => (d.id === "dev3" ? { ...d, dataLost: s.hour } : d));
    expect(text(s, "ls", at)).toBe("");
    s.hour += 1;
    sh(s, "touch new", at);
    expect(text(s, "ls", at)).toBe("new");
    expect(s.files.dev3.since).toBe(s.hour);
  });

  it("survive a save and load, and an older save loads without any", () => {
    const s = fresh();
    sh(s, "echo hi > note");
    expect(treeOf(deserialize(serialize(s)), "desk")["/home/you/note"]).toBe("hi\n");
    const old = JSON.parse(serialize(s));
    delete old.files;
    expect(deserialize(JSON.stringify(old)).files).toEqual({});
  });

  it("complete paths after a file command", () => {
    const s = fresh(), at = server(s);
    expect(complete(s, at, "cat /etc/os").line).toBe("cat /etc/os-release ");
    expect(complete(s, at, "cd /et").line).toBe("cd /etc/");
    expect(complete(s, at, "ls /etc/").options).toEqual(["apt/", "hostname", "os-release"]);
  });
});

describe("the desktop in ~/Desktop", () => {
  const note = (s: GameState, title: string) => s.docs.find((d) => d.title === title);

  it("shows Getting started as its checklist and keeps it read-only", () => {
    const s = fresh();
    expect(text(s, "ls ~/Desktop")).toBe("Getting started");
    expect(text(s, "cat ~/Desktop/Getting\\ started").split("\n")).toContain("[ ] Style your company");
    expect(text(s, "rm ~/Desktop/Getting\\ started")).toBe("rm: cannot remove '~/Desktop/Getting started': Permission denied");
    expect(text(s, "echo hi > 'Desktop/Getting started'")).toBe("bash: Desktop/Getting started: Permission denied");
    expect(text(s, "edit 'Desktop/Getting started'")).toBe("edit: Desktop/Getting started: Permission denied");
    expect(text(s, "rm -r Desktop")).toBe("rm: cannot remove 'Desktop': Permission denied");
    expect(text(s, "mkdir Desktop/sub")).toBe("mkdir: cannot create directory 'Desktop/sub': Permission denied");
    expect(s.docs.map((d) => d.kind)).toEqual(["guide"]);
  });

  it("turns new files into notes and edits, renames and removes them", () => {
    const s = fresh();
    sh(s, "echo 'call the bank' > Desktop/todo");
    const id = note(s, "todo")!.id;
    expect(note(s, "todo")!.body).toBe("call the bank\n");
    sh(s, "echo later >> Desktop/todo && mv Desktop/todo Desktop/plan");
    expect(s.docs.find((d) => d.id === id)).toMatchObject({ title: "plan", body: "call the bank\nlater\n" });
    sh(s, "rm Desktop/plan");
    expect(s.docs.some((d) => d.id === id)).toBe(false);
    expect(Object.keys(s.files.desk?.paths ?? {}).some((p) => p.includes("Desktop"))).toBe(false);
  });

  it("names notes with the same title apart", () => {
    const s = fresh();
    for (const body of ["a", "b"]) { const r = addNote(s); editNote(s, r.ok ? r.id! : "", { body }); }
    expect(text(s, "ls Desktop")).toBe("Getting started  Untitled  Untitled (2)");
    expect(text(s, "cat 'Desktop/Untitled (2)'")).toBe("b");
  });

  it("opens files in edit, and saving writes them", () => {
    const s = fresh();
    sh(s, "echo draft > Desktop/memo");
    expect(runCommand(s, null, "edit Desktop/memo").edit).toEqual({ path: "/home/you/Desktop/memo", name: "Desktop/memo", text: "draft\n" });
    expect(runCommand(s, null, "edit fresh.txt").edit?.text).toBe("");
    expect(text(s, "edit Desktop")).toBe("edit: Desktop: Is a directory");
    expect(sh(s, "edit Desktop/memo; echo skipped").output).toEqual([]);
  });

  it("completes names with spaces escaped", () => {
    const s = fresh();
    expect(complete(s, null, "cat Desktop/Get").line).toBe("cat Desktop/Getting\\ started ");
  });
});

describe("multi-line paste", () => {
  it("runs every pasted line but the last in order and keeps the last typed", () => {
    const r = splitPaste("", 0, 0, "apt-get install -y linux-image-openveezee\napt-get install -y vzctl\r\nreboot");
    expect(r).toEqual({ run: ["apt-get install -y linux-image-openveezee", "apt-get install -y vzctl"], draft: "reboot" });
    expect(splitPaste("echo ab", 5, 6, "x\ny")).toEqual({ run: ["echo x"], draft: "yb" });
    expect(splitPaste("", 0, 0, "touch a\nls\n").draft).toBe("");
  });

  it("runs the pasted lines against the state the previous line left", () => {
    const s = fresh();
    const { run } = splitPaste("", 0, 0, "touch pasted.txt\nls\n");
    const out = run.map((line) => text(s, line));
    expect(out[1]).toContain("pasted.txt");
  });
});
