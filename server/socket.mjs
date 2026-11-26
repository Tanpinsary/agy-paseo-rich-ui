import net from "node:net";
import { lstat, mkdir, rmdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function directory(id) {
  if (!uuid.test(id)) throw new Error("Invalid form ID");
  return "/tmp/paseo-agy-" + id;
}

function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    function onData(chunk) {
      buffer += chunk;
      if (buffer.length > 131072)
        return finish(new Error("Form message too large"));
      const end = buffer.indexOf("\n");
      if (end >= 0) {
        try {
          finish(null, JSON.parse(buffer.slice(0, end)));
        } catch (error) {
          finish(error);
        }
      }
    }
    function finish(error, value) {
      socket.off("data", onData);
      socket.off("close", closed);
      socket.off("error", failed);
      if (error) reject(error);
      else resolve(value);
    }
    const closed = () => finish(new Error("Form connection closed"));
    const failed = (error) => finish(error);
    socket
      .setEncoding("utf8")
      .on("data", onData)
      .once("close", closed)
      .once("error", failed);
  });
}

export async function openForm(agentId, form, submit) {
  const id = randomUUID();
  const dir = directory(id);
  await mkdir(dir, { mode: 0o700 });
  const path = dir + "/form";
  let active = true;
  const server = net.createServer(async (socket) => {
    socket.on("error", () => {});
    socket.setTimeout(5000, () => socket.destroy());
    try {
      const request = await readLine(socket);
      if (!active || request.agentId !== agentId)
        throw new Error("Form expired");
      if (request.op === "inspect") {
        socket.end(JSON.stringify({ form }) + "\n");
      } else {
        if (request.op !== "submit") throw new Error("Unknown form operation");
        submit(request.reply);
        active = false;
        socket.end('{"ok":true}\n');
      }
    } catch (error) {
      socket.end(JSON.stringify({ error: error.message }) + "\n");
    }
  });
  try {
    await new Promise((resolve, reject) =>
      server.once("error", reject).listen(path, resolve),
    );
  } catch (error) {
    await rmdir(dir).catch(() => {});
    throw error;
  }
  return {
    id,
    close() {
      active = false;
      // Let already-accepted RPCs flush their acknowledgement before closing.
      server.close(() => {
        void rmdir(dir).catch(() => {});
      });
    },
  };
}

export async function formRpc(request) {
  const dir = directory(request.id);
  const stat = await lstat(dir);
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid() ||
    stat.mode & 0o077
  ) {
    throw new Error("Invalid local form endpoint");
  }
  const socket = net.createConnection(dir + "/form");
  socket.setTimeout(5000, () =>
    socket.destroy(new Error("Form RPC timed out")),
  );
  try {
    const response = readLine(socket);
    socket.write(JSON.stringify(request) + "\n");
    const result = await response;
    if (result.error) throw new Error(result.error);
    return result;
  } finally {
    socket.destroy();
  }
}
