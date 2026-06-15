/**
 * Splash screen display — pure terminal output, no npm dependencies.
 */

export function displaySplash(version?: string): void {
  const GOLD = '\x1b[38;2;244;197;66m';
  const CYAN = '\x1b[36;1m';
  const WHITE = '\x1b[1;37m';
  const GRAY = '\x1b[0;37m';
  const YELLOW = '\x1b[1;33m';
  const RESET = '\x1b[0m';

  const B = `${CYAN}║${RESET}`;
  const S73 = ' '.repeat(73);
  const HR = '═'.repeat(73);

  const lines = [
    '',
    `  ${CYAN}╔${HR}╗${RESET}`,
    `  ${B}${S73}${B}`,
    `  ${B}  ${GOLD}██╗   ██╗ █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ${RESET}  ${B}`,
    `  ${B}  ${GOLD}██║   ██║██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗${RESET}  ${B}`,
    `  ${B}  ${GOLD}██║   ██║███████║██╔██╗ ██║██║  ███╗██║   ██║███████║██████╔╝██║  ██║${RESET}  ${B}`,
    `  ${B}  ${GOLD}╚██╗ ██╔╝██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║${RESET}  ${B}`,
    `  ${B}   ${GOLD}╚████╔╝ ██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝${RESET}  ${B}`,
    `  ${B}    ${GOLD}╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ${RESET}  ${B}`,
    `  ${B}${S73}${B}`,
    `  ${B}               ${CYAN}╔════════════════════════════════════╗${RESET}               ${B}`,
    `  ${B}               ${CYAN}║${RESET}  ${WHITE}AI Penetration Testing Framework${RESET}  ${CYAN}║${RESET}               ${B}`,
    `  ${B}               ${CYAN}╚════════════════════════════════════╝${RESET}               ${B}`,
    `  ${B}${S73}${B}`,
  ];

  if (version) {
    const verStr = `v${version}`;
    const verPadLeft = Math.floor((73 - verStr.length) / 2);
    const verPadRight = 73 - verStr.length - verPadLeft;
    lines.push(`  ${B}${' '.repeat(verPadLeft)}${GRAY}${verStr}${RESET}${' '.repeat(verPadRight)}${B}`);
  }

  lines.push(
    `  ${B}${S73}${B}`,
    `  ${B}                      ${YELLOW}🔐 DEFENSIVE SECURITY ONLY 🔐${RESET}                    ${B}`,
    `  ${B}${S73}${B}`,
    `  ${CYAN}╚${HR}╝${RESET}`,
    '',
  );

  console.log(lines.join('\n'));
}
