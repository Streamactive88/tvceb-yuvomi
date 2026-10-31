import { emitKeypressEvents } from 'node:readline';

export function recoveryOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (Object.hasOwn(options, key)) throw Error('Duplicate recovery option.');
    if (['--list', '--temporary-password'].includes(key)) options[key] = true;
    else if (['--user-id', '--username'].includes(key)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('Missing recovery option value.');
      options[key] = args[++i];
    } else throw Error('Unknown recovery option. Temporary passwords must be entered at the hidden prompt; configure ADMIN_RECOVERY_FILE in the server environment for another output path.');
  }
  return options;
}

export function promptSecret({ input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY || !input.setRawMode) throw Error('Temporary password entry requires an interactive terminal.');
  emitKeypressEvents(input);
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = !!input.isRaw;
    const cleanup = () => { input.off('keypress', onKey); input.setRawMode(wasRaw); input.pause(); output.write('\n'); };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(Error('Recovery cancelled.')); }
      else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        if (!value) reject(Error('Temporary password cannot be empty.'));
        else resolve(value);
      } else if (key.name === 'backspace') value = [...value].slice(0, -1).join('');
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    };
    output.write('Temporary password (hidden): ');
    input.setRawMode(true); input.resume(); input.on('keypress', onKey);
  });
}
