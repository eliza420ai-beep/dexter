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
        `${theme.muted('Try: ')}${theme.primary('/full-loop')}${theme.muted(' · ')}${theme.primary('/suggest')}${theme.muted(' · ')}${theme.primary('/double-check')}${theme.muted(' · ')}${theme.primary('/write-essay')}`,
        0,
        0,
      ),
    );
    this.addChild(
      new Text(
        `${theme.muted('Or: ')}${theme.primary('/suggest-tastytrade')}${theme.muted(' · ')}${theme.primary('/suggest-hl')}${theme.muted(' · ')}${theme.primary('/weekly')}${theme.muted(' · ')}${theme.primary('/quarterly')}`,
        0,
        0,
      ),
    );
    this.addChild(
      new Text(
        `${theme.muted('Options: ')}${theme.primary('/options-tastytrade')}${theme.muted(' · ')}${theme.primary('/options-hl')}${theme.muted(' · aliases: /LFG /options /hypersurface')}`,
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
