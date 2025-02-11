import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { selectIsContextMenuTranslucent } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';

import EmojiAndCustomEmojiPicker from '../../common/EmojiAndCustomEmojiPicker';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';

import styles from './FolderIconPicker.module.scss';
import './FolderIconEmojiSearch.scss'

export type OwnProps = {
  isOpen: boolean;
  buttonRef: RefObject<HTMLButtonElement>;
  onEmojiSelect: (emoji: ApiSticker) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

const FolderIconPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  buttonRef,
  areFeaturedStickersLoaded,
  isTranslucent,
  onEmojiSelect,
  onClose,
}) => {
  const { loadFeaturedEmojiStickers } = getActions();

  const transformOriginX = useRef<number>();
  const [isContextMenuShown, markContextMenuShown, unmarkContextMenuShown] = useFlag();
  useEffect(() => {
    transformOriginX.current = buttonRef.current!.getBoundingClientRect().right;
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  const handleEmojiSelect = useCallback((sticker: ApiSticker) => {
    onEmojiSelect(sticker);
    onClose();
  }, [onClose, onEmojiSelect]);

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        noCompact
        positionY="top"
        positionX="right"
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        transformOriginX={transformOriginX.current}
        noCloseOnBackdrop={isContextMenuShown}
      >
        <EmojiAndCustomEmojiPicker
          idPrefix="folder-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          isFolderIconPicker
          onEmojiSelect={handleEmojiSelect}
          isTranslucent={isTranslucent}
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onContextMenuClick={onClose}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
    isTranslucent: selectIsContextMenuTranslucent(global),
  };
})(FolderIconPicker));
