import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import packageJson from '../../package.json';
import { getModelDisplayName } from '../utils/model.js';
import { theme } from '../theme.js';

const INTRO_WIDTH = 50;

export class IntroComponent extends Container {
  private readonly modelText: Text;

  constructor(model: string) {
    super();

    const welcomeText = 'Welcome to Dexter';
    const versionText = ` v${packageJson.version}`;
    const fullText = welcomeText + versionText;
    const padding = Math.floor((INTRO_WIDTH - fullText.length - 2) / 2);
    const trailing = INTRO_WIDTH - fullText.length - padding - 2;

    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(
      new Text(
        theme.primary(
          `║${' '.repeat(padding)}${theme.bold(welcomeText)}${theme.muted(versionText)}${' '.repeat(
            trailing,
          )}║`,
        ),
        0,
        0,
      ),
    );
    this.addChild(new Text(theme.primary('═'.repeat(INTRO_WIDTH)), 0, 0));
    this.addChild(new Spacer(1));

    this.addChild(
      new Text(
        theme.bold(
          theme.primary(
            `
██████╗ ███████╗██╗  ██╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔════╝██╔══██╗
██║  ██║█████╗   ╚███╔╝    ██║   █████╗  ██████╔╝
██║  ██║██╔══╝   ██╔██╗    ██║   ██╔══╝  ██╔══██╗
██████╔╝███████╗██╔╝ ██╗   ██║   ███████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`,
          ),
        ),
        0,
        0,
      ),
    );

    this.addChild(new Spacer(1));
    this.addChild(new Text('Your AI assistant for deep financial research.', 0, 0));
    this.modelText = new Text('', 0, 0);
    this.addChild(this.modelText);
    this.addChild(
      new Text(
        `${theme.muted('Loop: ')}${theme.primary('/btc-temp-check')}${theme.muted(' · ')}${theme.primary('/write-essay')}${theme.muted(' · ')}${theme.primary('/close-loop')}`,
        0,
        0,
      ),
    );
    this.addChild(
      new Text(
        `${theme.muted('Build: ')}${theme.primary('/suggest')}${theme.muted(' · ')}${theme.primary('/suggest-tastytrade')}${theme.muted(' · ')}${theme.primary('/suggest-hl')}${theme.muted(' · ')}${theme.primary('/double-check')}`,
        0,
        0,
      ),
    );
    this.addChild(
      new Text(
        `${theme.muted('Theses: ')}${theme.primary('/thesis')}${theme.muted(' · ')}${theme.primary('/refresh-thesis')}${theme.muted(' · ')}${theme.primary('/portfolio-theses')}`,
        0,
        0,
      ),
    );
    this.addChild(
      new Text(
        `${theme.muted('Track: ')}${theme.primary('/weekly')}${theme.muted(' · ')}${theme.primary('/quarterly')}${theme.muted(' · options: ')}${theme.primary('/options-tastytrade')}${theme.muted(' · ')}${theme.primary('/options-hl')}`,
        0,
        0,
      ),
    );
    this.setModel(model);
  }

  setModel(model: string) {
    this.modelText.setText(
      `${theme.muted('Model: ')}${theme.primary(getModelDisplayName(model))}${theme.muted(
        '. Type /model to change.',
      )}`,
    );
  }
}
