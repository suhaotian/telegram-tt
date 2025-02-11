import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
  useState,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type {
  ApiReaction, ApiSticker, ApiStickerSet,
} from '../../api/types';
import type { EmojiKeywords, StickerSetOrReactionsSetOrRecent } from '../../types';

import {
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../config';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectIsAlwaysHighPriorityEmoji,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
} from '../../global/selectors';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { pickTruthy, unique } from '../../util/iteratees';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../hooks/useScrolledState';
import useAsyncRendering from '../right/hooks/useAsyncRendering';
import { useStickerPickerObservers } from './hooks/useStickerPickerObservers';

import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Icon from './icons/Icon';
import StickerButton from './StickerButton';
import StickerSet from './StickerSet';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './CustomEmojiPicker.module.scss';
import { IconName } from '../../types/icons';
import { uncompressEmoji, type EmojiData, type EmojiModule, type EmojiRawData } from '../../util/emoji/emoji';
import EmojiCategory from '../middle/composer/EmojiCategory';
import { folderIconsName } from '../ui/FolderIcon';
import renderText from './helpers/renderText';
import CustomEmoji from './CustomEmoji';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';

type OwnProps = {
  chatId?: string;
  className?: string;
  pickerListClassName?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  idPrefix?: string;
  isFolderIconPicker?: boolean;
  isTranslucent?: boolean;
  onEmojiSelect: (sticker: ApiSticker) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  customEmojisById?: Record<string, ApiSticker>;
  chatEmojiSetId?: string;
  defaultTagReactions?: ApiReaction[];
  stickerSetsById: Record<string, ApiStickerSet>;
  addedCustomEmojiIds?: string[];
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isWithPaidReaction?: boolean;
  emojiKeywords?: EmojiKeywords;
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const TOP_REACTIONS_COUNT = 16;
const RECENT_REACTIONS_COUNT = 32;
const RECENT_DEFAULT_STATUS_COUNT = 7;
const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
const STICKER_SET_IDS_WITH_COVER = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);

const EmojiAndCustomEmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  pickerListClassName,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  stickerSetsById,
  chatEmojiSetId,
  idPrefix = '',
  customEmojiFeaturedIds,
  canAnimate,
  isTranslucent,
  isSavedMessages,
  isCurrentUserPremium,
  defaultTagReactions,
  isWithPaidReaction,
  onEmojiSelect,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
  emojiKeywords,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const prefix = `${idPrefix}-custom-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

  const lang = useOldLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];


    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [
    addedCustomEmojiIds,
    customEmojiFeaturedIds, stickerSetsById, lang, isSavedMessages, defaultTagReactions, chatEmojiSetId,
    isWithPaidReaction,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent || !isHidden);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

    const [emojiCategories, setEmojiCategories] = useState<EmojiCategoryData[]>([]);
    const emojiCategoriesLength = 1;
    const [emojis, setEmojis] = useState<AllEmojis>({});
  // Initialize data on first render.
    useEffect(() => {
      const exec = () => {
        setEmojiCategories(emojiData.categories);
        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, []);

  const handleEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onEmojiSelect(emoji);
  });

  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, _index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const index = _index + emojiCategoriesLength;
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (STICKER_SET_IDS_WITH_COVER.has(stickerSet.id) || stickerSet.hasThumbnail || !firstSticker) {
      const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === POPULAR_SYMBOL_SET_ID;
      const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSet(isRecent ? 0 : index)}
        >
          {isRecent ? (
            <Icon name="recent" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !canLoadAndPlay}
              forcePlayback
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
            />
          )}
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={buttonClassName}
        noPlay={!canAnimate || !canLoadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb={isTranslucent}
        onClick={selectStickerSet}
        clickArg={index}
        forcePlayback
      />
    );
  }

  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState([] as {type: 'emoji' | 'sticker', sticker: ApiSticker}[]);
  const [hasFocus, setFocus] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { currentTarget } = event;
    handleChangeSearchResult(currentTarget.value);
  }

  const installedSets = useMemo(() => allSets.filter(stickerSet => {
    return stickerSet.installedDate && !stickerSet.isArchived;
  }), [allSets]);
  const handleChangeSearchResult = useDebouncedCallback((searchValue: string) => {
    const value = searchValue.trim().toLowerCase();
    const searchResult = [] as {type: 'emoji' | 'sticker', sticker: ApiSticker}[];
    const LIMIT_SEARCH = 56;
    if (value && emojiKeywords?.keywords) {
        const visited: Record<string, boolean> = {};
        let ignoreSearch = false;
        Object.keys(emojiKeywords?.keywords).every(keyword => {
          if (ignoreSearch) return false;
          if (keyword.includes(value)) {
            const emojis = emojiKeywords?.keywords?.[keyword];
            if (emojis) {
              emojis.every(emoji => {
                if (emoji.length >= 4) return true;
                if (!visited[emoji]) {
                  searchResult.push({type: 'emoji', sticker: {emoji} as ApiSticker});
                  ignoreSearch = searchResult.length >= LIMIT_SEARCH;
                  visited[emoji]= true;
                }
                if (ignoreSearch) return false;
                installedSets.every(set => {
                  if (ignoreSearch) return false;
                  set.packs?.[emoji]?.every(sticker => {
                    if (!visited[sticker.id] && sticker.isCustomEmoji) {
                      searchResult.push({type: 'sticker', sticker: sticker});
                      visited[sticker.id]= true;
                      ignoreSearch = searchResult.length >= LIMIT_SEARCH;
                      if (ignoreSearch) return false;
                    }
                  })
                  return true;
                })
                return true;
              })
            }
          }
          return true;
        }
      )
    }
    setSearchValue(searchValue);
    setSearchResult(searchResult);
  }, [emojiKeywords, installedSets], 150, true);

  function handleFocus() {
    setFocus(true);
  }
  function handleBlur() {
    setFocus(false);
  }

  const fullClassName = buildClassName('StickerPicker', styles.root, className, (hasFocus || searchValue) && 'has-focus');
  if (!shouldRenderContent) {
    return (
      <div className={fullClassName}>
        {noPopulatedSets ? (
          <div className={pickerStyles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    pickerStyles.header,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
  );
  const listClassName = buildClassName(
    pickerStyles.main,
    pickerStyles.main_customEmoji,
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    pickerListClassName,
    pickerStyles.hasHeader,
  );

  const hasSearch = searchResult.length > 0 || searchValue;
  const noSearchResult = hasSearch && searchResult.length === 0;
  return (
    <div className={fullClassName}>
        <div
          ref={headerRef}
          className={headerClassName}
        >
          <div className="shared-canvas-container">
            <canvas ref={sharedCanvasRef} className="shared-canvas" />
            <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
            {[emojiCategories[0]].map((emojiItem, index) => {
              const icon = ICONS_BY_CATEGORY[emojiItem.id];
              const buttonClassName = buildClassName(
                pickerStyles.stickerCover,
                index === activeSetIndex && styles.activated,
              );
              return <Button
                key={emojiItem.id}
                className={buttonClassName}
                ariaLabel={emojiItem.name}
                round
                color="translucent"
                onClick={() => selectStickerSet(index)}
              >
                <Icon name={icon} className='folder-icon-category-icon' />
              </Button>
            })}
            {allSets.map(renderCover)}
          </div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleContentScroll}
          className={listClassName}
        >
          <div className='input-group FolderEmojiSearchInput'>
            <Icon name="search" className="search-icon"/>
            <input type="text" placeholder={lang('Search')} className='form-control' dir='auto'
            value={searchValue} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} />
          </div>
          {hasSearch && <div className='symbol-set-container'>{searchResult.map(item => {
            if (item.type === 'emoji') {
              return <div key={item.sticker.emoji} className='EmojiButton' onClick={() => handleEmojiSelect(item.sticker)}>{renderText(item.sticker.emoji as string)}</div>
            } else if (item.type === 'sticker') {
              return <CustomEmoji onClick={() => handleEmojiSelect(item.sticker)} key={item.sticker.id} documentId={item.sticker.id} className='EmojiButton' size={36} />
            }
          })}</div>}
          {noSearchResult && <div className={fullClassName}>
            <div className={pickerStyles.pickerDisabled}>{lang('NoEmojiFound')}</div>
          </div>}
          {!hasSearch && <>
            <div className='FolderEmojisGroup symbol-set-container'>{folderIconsName.map(item => {
              return <div key={item.iconName} className='EmojiButton' onClick={() => {
                handleEmojiSelect({ emoji: item.emoji } as ApiSticker)
              }}><Icon name={item.iconName} /></div>
            })}</div>
          
            <div id={`${prefix}-0`}>{emojiCategories.map((category, i) => (
              <EmojiCategory
                key={category.id}
                category={category}
                // id={`${prefix}-${i}`}
                index={i+1}
                allEmojis={emojis}
                // shouldRender={searchValue ? true : activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                shouldRender={true}
                shouldCalculateHeight={false}
                observeIntersection={observeIntersectionForSet}
                onEmojiSelect={(emoji) => {
                  handleEmojiSelect({ emoji } as ApiSticker)
                }}
              />
            ))}</div>
            {allSets.map((stickerSet, i) => {
              const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
                || (stickerSet.id === RECENT_SYMBOL_SET_ID);
              const isChatEmojiSet = stickerSet.id === chatEmojiSetId;
              const index= i + emojiCategoriesLength;
              return (
                <StickerSet
                  key={stickerSet.id}
                  stickerSet={stickerSet}
                  loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                  index={index}
                  idPrefix={prefix}
                  observeIntersection={observeIntersectionForSet}
                  observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                  observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                  isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                  isSavedMessages={isSavedMessages}
                  shouldHideHeader={shouldHideHeader}
                  isChatEmojiSet={isChatEmojiSet}
                  isCurrentUserPremium={isCurrentUserPremium}
                  isTranslucent={isTranslucent}
                  onStickerSelect={handleEmojiSelect}
                  onContextMenuOpen={onContextMenuOpen}
                  onContextMenuClose={onContextMenuClose}
                  onContextMenuClick={onContextMenuClick}
                  forcePlayback
                />
              );
            })}
          </>}
        </div>
    </div>
  );
};


const ICONS_BY_CATEGORY: Record<string, IconName> = {
  recent: 'recent',
  people: 'smile',
  nature: 'animals',
  foods: 'eats',
  activity: 'sport',
  places: 'car',
  objects: 'lamp',
  symbols: 'language',
  flags: 'flag',
};

type EmojiCategoryData = { id: string; name: string; emojis: string[] };
let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const {
      stickers: {
        setsById: stickerSetsById,
      },
      customEmojis: {
        byId: customEmojisById,
        featuredIds: customEmojiFeaturedIds,
        statusRecent: {
          emojis: recentStatusEmojis,
        },
      },
      recentCustomEmojis: recentCustomEmojiIds,
      reactions: {
        availableReactions,
        recentReactions,
        topReactions,
        defaultTags,
      },
      emojiKeywords,
    } = global;

    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    return {
      emojiKeywords: emojiKeywords[global.settings.byKey.language],
      customEmojisById: customEmojisById,
      stickerSetsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      customEmojiFeaturedIds,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
    };
  },
)(EmojiAndCustomEmojiPicker));


