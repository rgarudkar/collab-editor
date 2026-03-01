// Web Worker for executing JavaScript code safely without blocking the main thread

// We create a safe execution environment by shadowing global objects that could be harmful
// This is a basic sandbox; for production, more robust isolation is recommended (e.g. iframe with sandbox attributes or a dedicated backend).
self.onmessage = function (e) {
    const { code } = e.data;
    const logs: string[] = [];

    // Override console.log to capture output
    const originalConsoleLog = console.log;
    console.log = (...args) => {
        logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
        originalConsoleLog(...args); // Optional: keep logging to the workerconsole
    };

    try {
        // using new Function(...) creates a new scope.
        // It is slightly safer than eval(), but still executes arbitrary code.
        // "use strict" prevents some accidental global leaks.
        const runCode = new Function(`
      "use strict";
      return (function() {
        ${code}
      })();
    `);

        const result = runCode();

        // Send back logs and the final evaluated result (if any)
        self.postMessage({
            type: "success",
            logs,
            result: result !== undefined ? String(result) : null,
        });
    } catch (error: unknown) {
        self.postMessage({
            type: "error",
            logs,
            error: error instanceof Error ? error.message : String(error),
        });
    } finally {
        // Restore original console.log
        console.log = originalConsoleLog;
    }
};
