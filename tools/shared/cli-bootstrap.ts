// Shared CLI bootstrap for the five Unity families.
//
// Every family entry point does the same thing: resolve options from argv,
// handle `--list` (ability names), run the dispatcher, and emit either JSON or
// the family renderer's text. Each module supplies only its ability list,
// option resolver, dispatcher and renderer.
export interface CliBootstrap<Options extends { list: boolean; json: boolean }, Result> {
  abilities: readonly string[];
  resolveOptions: (argv: string[]) => Options;
  run: (options: Options) => Result;
  render: (result: Result) => string;
  argv?: string[];
  write?: (text: string) => void;
}

export function runCli<Options extends { list: boolean; json: boolean }, Result>(
  config: CliBootstrap<Options, Result>
): void {
  const argv = config.argv ?? process.argv.slice(2);
  const write = config.write ?? ((text: string) => process.stdout.write(text));
  const options = config.resolveOptions(argv);
  if (options.list) {
    write(config.abilities.join('\n') + '\n');
    return;
  }
  const result = config.run(options);
  if (options.json) {
    write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  write(config.render(result) + '\n');
}
