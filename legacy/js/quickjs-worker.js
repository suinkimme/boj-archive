import { getQuickJS } from "https://esm.sh/quickjs-emscripten";

let QuickJS = null;

/**
 * Initialize QuickJS WASM module
 */
async function initQuickJS() {
  try {
    QuickJS = await getQuickJS();
    self.postMessage({ type: "ready" });
  } catch (err) {
    self.postMessage({
      type: "result",
      id: null,
      output: null,
      error: "Failed to load QuickJS: " + err.message,
    });
  }
}

self.onmessage = async ({ data: { id, code, stdin } }) => {
  if (!QuickJS) {
    self.postMessage({
      type: "result",
      id,
      output: null,
      error: "QuickJS is not initialized yet.",
    });
    return;
  }

  // Create a new runtime for each execution
  const runtime = QuickJS.newRuntime();

  // Optional: Set memory limit (e.g., 16MB) to prevent OOM
  runtime.setMemoryLimit(16 * 1024 * 1024);

  const context = runtime.newContext();
  let output = "";

  /**
   * Implement console.log
   * Intercepts JavaScript's console output and redirects it to the Worker's output variable.
   */
  const logHandle = context.newFunction("log", (...args) => {
    const str = args.map((arg) => context.dump(arg)).join(" ");
    output += str + "\n";
  });

  const consoleHandle = context.newObject();
  context.setProp(consoleHandle, "log", logHandle);
  context.setProp(context.global, "console", consoleHandle);

  // Clean up handles to prevent memory leaks
  logHandle.dispose();
  consoleHandle.dispose();

  // Handle Stdin: Injects stdin data into a global variable named `_stdin`.
  const stdinHandle = context.newString(stdin ?? "");
  context.setProp(context.global, "_stdin", stdinHandle);
  stdinHandle.dispose();

  try {
    // Execute Code
    const result = context.evalCode(code);

    if (result.error) {
      // Runtime error occurred
      const error = context.dump(result.error);
      result.error.dispose();
      self.postMessage({
        type: "result",
        id,
        output: output || null,
        error: error.message || String(error),
      });
    } else {
      // Execution successful
      result.value.dispose();
      self.postMessage({
        type: "result",
        id,
        output: output || null,
        error: null,
      });
    }
  } catch (e) {
    // Unexpected critical error (e.g., internal WASM error)
    self.postMessage({
      type: "result",
      id,
      output: output || null,
      error: e.message ?? String(e),
    });
  } finally {
    // Resource Cleanup
    context.dispose();
    runtime.dispose();
  }
};

initQuickJS();
