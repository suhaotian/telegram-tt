import React, {
  memo, useMemo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';
import type {
  ThemeKey,
  IThemeSettings,
  ThreadId,
} from '../../types';

import { selectTheme } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { IS_ELECTRON } from '../../util/windowEnvironment';
import useCustomBackground from '../../hooks/useCustomBackground';
import WallpaperBackgroundGradient from '../left/settings/WallpaperBackgroundGradient';
import { numberToHexColor } from '../../util/colors';
import styles from './ChatBackground.module.scss';


interface OwnProps {
  isMobile?: boolean;
  renderingThreadId?: ThreadId;
  renderingChatId?: string;
  isRightColumnShown?: boolean;
}

type StateProps = {
  theme: ThemeKey;
  isBackgroundBlurred?: boolean;
  customBackground?: string;
} & Omit<IThemeSettings, 'background' | 'isBlurred'>;

function ChatBackground({
  renderingThreadId,
  renderingChatId,
  isRightColumnShown,
  theme,
  isBackgroundBlurred,
  backgroundColor,
  customBackground,
  settings,
  dark,
  pattern,
}: OwnProps & StateProps) {

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const bgClassName = buildClassName(
    styles.background,
    pattern && styles.isPattern,
    dark && styles.isDark,
    styles.withTransition,
    customBackground && !settings && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
    isRightColumnShown && styles.withRightColumn,
    IS_ELECTRON && !(renderingChatId && renderingThreadId) && styles.draggable,
  );
 const colors = useMemo(() => {
    if (!settings) return;
    const {
      backgroundColor,
      secondBackgroundColor,
      thirdBackgroundColor,
      fourthBackgroundColor,
    } = settings;
    return [backgroundColor, secondBackgroundColor, thirdBackgroundColor, fourthBackgroundColor]
    .filter(Boolean).map(item => numberToHexColor(item).slice(1));
  }, [settings]);


  return (
    <div
      className={bgClassName}
      style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
    >
      {colors && <WallpaperBackgroundGradient colors={colors} className={styles.colorsCanvas} />}
      {pattern && <div className={styles.wallpaperPattern}/>}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred, background: customBackground, ...rest
    } = global.settings.themes[theme] || {};

    const state: StateProps = {
      theme,
      customBackground,
      isBackgroundBlurred: isBlurred && !rest.settings,
      ...rest,
    };

    return state;
  },
)(ChatBackground));
