import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import { type ApiChatlistExportedInvite } from '../../../../api/types';
import type {
  FolderEditDispatch,
  FoldersState,
} from '../../../../hooks/reducers/useFoldersReducer';

import { STICKER_SIZE_FOLDER_SETTINGS } from '../../../../config';
import { isUserId } from '../../../../global/helpers';
import { selectCanShareFolder } from '../../../../global/selectors';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import { findIntersectionWithSet } from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { CUSTOM_PEER_EXCLUDED_CHAT_TYPES, CUSTOM_PEER_INCLUDED_CHAT_TYPES } from '../../../../util/objects/customPeer';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import { selectChatFilters } from '../../../../hooks/reducers/useFoldersReducer';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import GroupChatInfo from '../../../common/GroupChatInfo';
import Icon from '../../../common/icons/Icon';
import PrivateChatInfo from '../../../common/PrivateChatInfo';
import FloatingActionButton from '../../../ui/FloatingActionButton';
import InputText from '../../../ui/InputText';
import ListItem from '../../../ui/ListItem';
import Spinner from '../../../ui/Spinner';
import FolderIcon from "../../../ui/FolderIcon";
import FolderIconPicker from '../../main/FolderIconPicker.async';
import useFlag from '../../../../hooks/useFlag';
import Button from '../../../ui/Button';
import { getFolderState } from '../helpers/chatFolder';



type OwnProps = {
  state: FoldersState;
  dispatch: FolderEditDispatch;
  onAddIncludedChats: VoidFunction;
  onAddExcludedChats: VoidFunction;
  onShareFolder: VoidFunction;
  onOpenInvite: (url: string) => void;
  isActive?: boolean;
  isOnlyInvites?: boolean;
  onReset: () => void;
  onBack: () => void;
  onSaveFolder: (cb?: VoidFunction) => void;
};

type StateProps = {
  loadedActiveChatIds?: string[];
  loadedArchivedChatIds?: string[];
  invites?: ApiChatlistExportedInvite[];
  isRemoved?: boolean;
  maxInviteLinks: number;
  maxChatLists: number;
  chatListCount: number;
};

const SUBMIT_TIMEOUT = 500;

const INITIAL_CHATS_LIMIT = 5;

export const ERROR_NO_TITLE = 'Please provide a title for this folder.';
export const ERROR_NO_CHATS = 'ChatList.Filter.Error.Empty';

const SettingsFoldersEdit: FC<OwnProps & StateProps> = ({
  state,
  dispatch,
  onAddIncludedChats,
  onAddExcludedChats,
  onShareFolder,
  onOpenInvite,
  isActive,
  onReset,
  isRemoved,
  onBack,
  loadedActiveChatIds,
  isOnlyInvites,
  loadedArchivedChatIds,
  invites,
  maxInviteLinks,
  maxChatLists,
  chatListCount,
  onSaveFolder,
}) => {
  const {
    loadChatlistInvites,
    openLimitReachedModal,
    showNotification,
  } = getActions();

  const isCreating = state.mode === 'create';
  const isEditingChatList = state.folder.isChatList;

  const [isIncludedChatsListExpanded, setIsIncludedChatsListExpanded] = useState(false);
  const [isExcludedChatsListExpanded, setIsExcludedChatsListExpanded] = useState(false);
  const [isFolderIconPickerOpen, openFolderIconPicker, closeFolderIconPicker] = useFlag(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isRemoved) {
      onReset();
    }
  }, [isRemoved, onReset]);

  useEffect(() => {
    if (isActive && state.folderId && state.folder.isChatList) {
      loadChatlistInvites({ folderId: state.folderId });
    }
  }, [isActive, state.folder.isChatList, state.folderId]);

  const {
    selectedChatIds: includedChatIds,
    selectedChatTypes: includedChatTypes,
  } = useMemo(() => selectChatFilters(state, 'included'), [state]);
  const {
    selectedChatIds: excludedChatIds,
    selectedChatTypes: excludedChatTypes,
  } = useMemo(() => selectChatFilters(state, 'excluded'), [state]);

  useEffect(() => {
    setIsIncludedChatsListExpanded(false);
    setIsExcludedChatsListExpanded(false);
  }, [state.folderId]);

  const [visibleIncludedChatIds, visibleExcludedChatIds] = useMemo(() => {
    const allLoadedChatsSet = new Set([
      ...(loadedActiveChatIds || []),
      ...(loadedArchivedChatIds || []),
    ]);

    const loadedIncludedChatIds = findIntersectionWithSet(includedChatIds, allLoadedChatsSet);
    const loadedExcludedChatIds = findIntersectionWithSet(excludedChatIds, allLoadedChatsSet);

    return [
      isIncludedChatsListExpanded
        ? loadedIncludedChatIds
        : loadedIncludedChatIds.slice(0, INITIAL_CHATS_LIMIT - includedChatTypes.length),
      isExcludedChatsListExpanded
        ? loadedExcludedChatIds
        : loadedExcludedChatIds.slice(0, INITIAL_CHATS_LIMIT - excludedChatTypes.length),
    ];
  }, [
    excludedChatIds, includedChatIds, includedChatTypes, excludedChatTypes,
    isExcludedChatsListExpanded, isIncludedChatsListExpanded,
    loadedActiveChatIds, loadedArchivedChatIds,
  ]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack,
  });


  const { titleText, customEmojiEntity, hasCustomEmoji } = useMemo(() => {
    const { titleText, customEmojiEntity } = getFolderState(state.folder);
    return { titleText, customEmojiEntity, hasCustomEmoji: Boolean(customEmojiEntity) }
  }, [state.folder]);
    

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { currentTarget } = event;
    const payload = currentTarget.value.trim();
    dispatch({ type: 'setTitle', payload });
  }, [dispatch]);

  const handleEmoticonSelect = useCallback((emoji: string, documentId?: string) => {
    dispatch({ type: 'setEmoticon', payload: { emoticon: emoji, documentId } });
  }, [dispatch]);
  
  const handleAnimationToggle = useCallback(() => {
    dispatch({ type: 'toggleTitleAnimation'  });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    dispatch({ type: 'setIsLoading', payload: true });

    onSaveFolder(() => {
      setTimeout(() => {
        onReset();
      }, SUBMIT_TIMEOUT);
    });
  }, [dispatch, onSaveFolder, onReset]);

  const handleCreateInviteClick = useCallback(() => {
    if (!invites) {
      if (isCreating) {
        onSaveFolder(onShareFolder);
      }
      return;
    }

    // Ignoring global updates is a known drawback here
    if (!selectCanShareFolder(getGlobal(), state.folderId!)) {
      showNotification({ message: lang('ChatList.Filter.InviteLink.IncludeExcludeError') });
      return;
    }

    if (chatListCount >= maxChatLists && !state.folder.isChatList) {
      openLimitReachedModal({
        limit: 'chatlistJoined',
      });
      return;
    }

    if (invites.length < maxInviteLinks) {
      if (state.isTouched) {
        onSaveFolder(onShareFolder);
      } else {
        onShareFolder();
      }
      return;
    }

    openLimitReachedModal({
      limit: 'chatlistInvites',
    });
  }, [
    invites, state.folderId, state.isTouched, chatListCount, maxInviteLinks, isCreating, onSaveFolder,
    onShareFolder, lang, maxChatLists, state.folder.isChatList,
  ]);

  const handleEditInviteClick = useCallback((e: React.MouseEvent<HTMLElement>, url: string) => {
    if (state.isTouched) {
      onSaveFolder(() => onOpenInvite(url));
    } else {
      onOpenInvite(url);
    }
  }, [onSaveFolder, onOpenInvite, state.isTouched]);

  function renderChatType(key: string, mode: 'included' | 'excluded') {
    const chatType = mode === 'included'
      ? CUSTOM_PEER_INCLUDED_CHAT_TYPES.find(({ type: typeKey }) => typeKey === key)
      : CUSTOM_PEER_EXCLUDED_CHAT_TYPES.find(({ type: typeKey }) => typeKey === key);

    if (!chatType) {
      return undefined;
    }

    return (
      <ListItem
        key={chatType.type}
        className="mb-1 settings-folders-list-item"
        narrow
        inactive
      >
        <PrivateChatInfo
          avatarSize="small"
          customPeer={chatType}
        />
      </ListItem>
    );
  }

  function renderChats(mode: 'included' | 'excluded') {
    const selectedChatTypes = mode === 'included' ? includedChatTypes : excludedChatTypes;
    const visibleChatIds = mode === 'included' ? visibleIncludedChatIds : visibleExcludedChatIds;

    const isExpanded = mode === 'included' ? isIncludedChatsListExpanded : isExcludedChatsListExpanded;
    const allChatIds = mode === 'included' ? includedChatIds : excludedChatIds;
    const leftChatsCount = allChatIds.length - visibleChatIds.length;
    const clickHandler = mode === 'included'
      ? () => setIsIncludedChatsListExpanded(true)
      : () => setIsExcludedChatsListExpanded(true);

    return (
      <>
        {selectedChatTypes.map((key) => renderChatType(key, mode))}
        {visibleChatIds.map((id) => (
          <ListItem
            className="mb-1 settings-folders-list-item"
            narrow
            inactive
          >
            {isUserId(id) ? (
              <PrivateChatInfo avatarSize="small" userId={id} />
            ) : (
              <GroupChatInfo avatarSize="small" chatId={id} />
            )}
          </ListItem>
        ))}
        {(!isExpanded && leftChatsCount > 0) && (
          <ListItem
            key="load-more"
            className="settings-folders-list-item"
            narrow
            // eslint-disable-next-line react/jsx-no-bind
            onClick={clickHandler}
            icon="down"
          >
            {lang('FilterShowMoreChats', leftChatsCount, 'i')}
          </ListItem>
        )}
      </>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <div className="custom-scroll no-border settings-content">
        <div className="settings-content-header">
          <AnimatedIconWithPreview
            size={STICKER_SIZE_FOLDER_SETTINGS}
            tgsUrl={LOCAL_TGS_URLS.FoldersNew}
            play={String(state.folderId)}
            className="settings-content-icon"
          />

          {isCreating && (
            <p className="settings-item-description mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('FilterIncludeInfo')}
            </p>
          )}
          {hasCustomEmoji && <div className='settings-folders-animation-toggle-button'
            dir={lang.isRtl ? 'rtl' : undefined}
            onClick={handleAnimationToggle}>{
            state.folder.noTitleAnimations ? lang('lng_filters_enable_animations') : lang('lng_filters_disable_animations')
          }</div>}
          <InputText
            className="mb-0"
            label={lang('FilterNameHint')}
            value={titleText}
            onChange={handleChange}
            error={state.error && state.error === ERROR_NO_TITLE ? ERROR_NO_TITLE : undefined}
          >
            <Button
              round
              ref={buttonRef}
              className="settings-folders-symbol-menu-button"
              color="translucent"
              onClick={openFolderIconPicker}
              ariaLabel="Choose emoji or sticker"
            >
              <FolderIcon
                folderId={state.folderId}
                folderIcon={state.folder.emoticon}
                documentId={customEmojiEntity?.documentId}
                noTitleAnimations={state.folder.noTitleAnimations}
              />
            </Button>
          </InputText>
        </div>


        <FolderIconPicker buttonRef={buttonRef} onEmojiSelect={sticker => {
            handleEmoticonSelect(sticker.emoji as string, sticker.id);
          }} isOpen={isFolderIconPickerOpen} onClose={closeFolderIconPicker} />

        {!isOnlyInvites && (
          <div className="pt-3 settings-item">
            {state.error && state.error === ERROR_NO_CHATS && (
              <p className="settings-item-description mb-2 color-danger" dir={lang.isRtl ? 'rtl' : undefined}>
                {lang(state.error)}
              </p>
            )}

            <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterInclude')}</h4>

            <ListItem
              className="settings-folders-list-item color-primary"
              icon="add"
              narrow
              onClick={onAddIncludedChats}
            >
              {lang('FilterAddChats')}
            </ListItem>

            {renderChats('included')}
          </div>
        )}

        {!isOnlyInvites && !isEditingChatList && (
          <div className="pt-3 settings-item">
            <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterExclude')}</h4>

            <ListItem
              className="settings-folders-list-item color-primary"
              icon="add"
              narrow
              onClick={onAddExcludedChats}
            >
              {lang('FilterAddChats')}
            </ListItem>

            {renderChats('excluded')}
          </div>
        )}

        <div className="pt-3 settings-item">
          <h4 className="settings-item-header mb-3" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('FolderLinkScreen.Title')}
          </h4>

          <ListItem
            className="settings-folders-list-item color-primary"
            icon="add"
            narrow
            onClick={handleCreateInviteClick}
          >
            {lang('ChatListFilter.CreateLinkNew')}
          </ListItem>

          {invites?.map((invite) => (
            <ListItem
              className="settings-folders-list-item"
              icon="link"
              narrow
              multiline
              onClick={handleEditInviteClick}
              clickArg={invite.url}
            >
              <span className="title" dir="auto">{invite.title || invite.url}</span>
              <span className="subtitle">
                {lang('ChatListFilter.LinkLabelChatCount', invite.peerIds.length, 'i')}
              </span>
            </ListItem>
          ))}

        </div>
      </div>

      <FloatingActionButton
        isShown={Boolean(state.isTouched)}
        disabled={state.isLoading}
        onClick={handleSubmit}
        ariaLabel={state.mode === 'edit' ? 'Save changes' : 'Create folder'}
      >
        {state.isLoading ? (
          <Spinner color="white" />
        ) : (
          <Icon name="check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { state }): StateProps => {
    const { listIds } = global.chats;
    const { byId, invites } = global.chatFolders;
    const chatListCount = Object.values(byId).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);

    return {
      loadedActiveChatIds: listIds.active,
      loadedArchivedChatIds: listIds.archived,
      invites: state.folderId ? (invites[state.folderId] || MEMO_EMPTY_ARRAY) : undefined,
      isRemoved: state.folderId !== undefined && !byId[state.folderId],
      maxInviteLinks: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      chatListCount,
    };
  },
)(SettingsFoldersEdit));
