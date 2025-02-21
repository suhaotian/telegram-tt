import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';

import type { ApiWallpaper } from '../../../api/types';
import type { ThemeKey } from '../../../types';
import { UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { CUSTOM_BG_CACHE_NAME, TGV_MIME_TYPE } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import * as cacheApi from '../../../util/cacheApi';
import { fetchBlob } from '../../../util/files';

import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './WallpaperTile.scss';
import WallpaperBackgroundGradient from './WallpaperBackgroundGradient';
import { numberToHexColor } from '../../../util/colors';
import { ungzip } from 'pako';
import fixFirefoxSvg from '../../../util/fixFirefoxSvg';
import { IS_FIREFOX } from '../../../util/windowEnvironment';

type OwnProps = {
  wallpaper: ApiWallpaper;
  theme: ThemeKey;
  isSelected: boolean;
  onClick: (id: string) => void;
};

const WallpaperTile: FC<OwnProps> = ({
  wallpaper,
  theme,
  isSelected,
  onClick,
}) => {
  const { id, document } = wallpaper;
  const localMediaHash = `wallpaper${document?.id!}`;
  const localBlobUrl = document?.previewBlobUrl;
  const previewBlobUrl = useMedia(document?.id && `${localMediaHash}?size=m`);
  const imgSrc = previewBlobUrl || localBlobUrl;
  const { transitionClassNames } = useShowTransitionDeprecated(
    Boolean(imgSrc),
    undefined,
    undefined,
    'slow',
  );
  const isLoadingRef = useRef(false);
  const [isLoadAllowed, setIsLoadAllowed] = useState(false);
  const {
    mediaData: fullMedia, loadProgress,
  } = useMediaWithLoadProgress(localMediaHash, !isLoadAllowed);
  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;
  const { shouldRender: shouldRenderSpinner, transitionClassNames: spinnerClassNames } = useShowTransitionDeprecated(
    (isLoadAllowed && !fullMedia) || id === UPLOADING_WALLPAPER_SLUG,
    undefined,
    wasLoadDisabled,
    'slow',
  );
  // To prevent triggering of the effect for useCallback
  const cacheKeyRef = useRef<string>();
  cacheKeyRef.current = theme;

  const handleSelect = useCallback(() => {
    (async () => {
      if (imgSrc) {
        let blob = await fetchBlob(fullMedia!);
        blob = await convertTgvFileToBlob(blob);
        await cacheApi.save(CUSTOM_BG_CACHE_NAME, cacheKeyRef.current!, blob);
      }
      onClick(id);
    })();
  }, [fullMedia, onClick, id]);

  useEffect(() => {
    // If we've clicked on a wallpaper, select it when full media is loaded
    if (fullMedia && isLoadingRef.current) {
      handleSelect();
      isLoadingRef.current = false;
    }
  }, [fullMedia, handleSelect]);

  const handleClick = useCallback(() => {
    if (fullMedia || !imgSrc) {
      handleSelect();
    } else {
      isLoadingRef.current = true;
      setIsLoadAllowed((isAllowed) => !isAllowed);
    }
  }, [fullMedia, handleSelect, imgSrc]);

  const isDark = (wallpaper?.wallpaper || wallpaper?.wallpaperNoFile)?.dark;
  const isPattern = !!wallpaper?.wallpaper?.pattern;
  const backgroundSettings = (wallpaper?.wallpaper || wallpaper?.wallpaperNoFile)?.settings;
  const colors = useMemo(() => {
    if (!backgroundSettings) return;
    const {
      backgroundColor,
      secondBackgroundColor,
      thirdBackgroundColor,
      fourthBackgroundColor,
    } = backgroundSettings;
    return [backgroundColor, secondBackgroundColor, thirdBackgroundColor, fourthBackgroundColor]
    .filter(Boolean).map(item => numberToHexColor(item).slice(1));
  }, [backgroundSettings]);

  const className = buildClassName(
    'WallpaperTile',
    isSelected && 'selected',
    isPattern && 'is-pattern',
    isDark && 'is-dark',
  );

  return (
    <div className={className} onClick={handleClick} style={imgSrc && isPattern && isDark ? `--mask-img-url: url("${imgSrc}")` : ''}>
      <div className="media-inner">
        {colors && <WallpaperBackgroundGradient colors={colors} className='media-canvas' />}
        <div
          className={buildClassName('full-media', 'media-photo', transitionClassNames)}
          style={`background-image:url("${imgSrc}")`}
        />
        {shouldRenderSpinner && (
          <div className={buildClassName('spinner-container', spinnerClassNames)}>
            <ProgressSpinner progress={loadProgress} onClick={handleClick} />
          </div>
        )}
      </div>
    </div>
  );
};

const convertTgvFileToBlob = async (blob: Blob) => {
  let result!: Blob | string | Uint8Array;
  if (blob.type === TGV_MIME_TYPE) {
    if (IS_FIREFOX) {
      result = await ungzip(await blob.arrayBuffer(), {to: 'string'});
      result = fixFirefoxSvg(result) || result;
      const textEncoder = new TextEncoder();
      result = textEncoder.encode(result);
    } else {
      result = await ungzip(await blob.arrayBuffer());
    }
    result = new Blob([result], { type: 'image/svg+xml' });
  }
  return result as Blob || blob;
}

export default memo(WallpaperTile);
