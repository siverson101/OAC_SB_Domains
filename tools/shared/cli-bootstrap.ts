// Shared CLI bootstrap for the five Unity families.
//
// Every family entry point does the same thing: resolve options from argv,
// handle `--list` (ability names), run the dispatcher, and emit either JSON or
// the family renderer's text. Each module supplies only its ability list,
// option resolver, dispatcher and renderer.
export interface CliBootstrap<Options extends { list: boolean; json: boolean }, Result> {
  abilities: readonly string[];
  resolveOptions: (argv: string[]) => Options;
  // A handler may be synchronous or asynchronous; `runCli` awaits it either way.
  run: (options: Options) => Result | Promise<Result>;
  render: (result: Result) => string;
  argv?: string[];
  write?: (text: string) => void;
}

function isThenable<Result>(value: Result | Promise<Result>): value is Promise<Result> {
  return typeof (value as Promise<Result> | null)?.then === 'function';
}

export function runCli<Options extends { list: boolean; json: boolean }, Result>(
  config: CliBootstrap<Options, Result>
): void {
  const argv = config.argv ?? process.argv.slice(2);
  const write = config.write ?? ((text: string) => process.stdout.write(text));
  let options: Options;
  try {
    options = config.resolveOptions(argv);
  } catch (error) {
    // A usage error (e.g. a stray positional) is reported cleanly, not as an
    // uncaught stack trace.
    write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.list) {
    // A family with no abilities (e.g. studio-config) prints nothing rather
    // than a stray blank line.
    if (config.abilities.length > 0) write(config.abilities.join('\n') + '\n');
    return;
  }

  const emit = (result: Result): void => {
    if (options.json) {
      write(JSON.stringify(result, null, 2) + '\n');
      return;
    }
    write(config.render(result) + '\n');
  };

  let result: Result | Promise<Result>;
  try {
    result = config.run(options);
  } catch (error) {
    // A synchronous throw (e.g. an unknown ability) is reported like an async
    // rejection rather than escaping as an uncaught exception.
    write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  if (isThenable(result)) {
    // The pending timer inside an async handler keeps the process alive until
    // the result is ready; errors are surfaced rather than swallowed.
    void result.then(emit).catch((error: unknown) => {
      write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
    return;
  }
  emit(result);
}
