import type { FC, StateHookSetter } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiInputMessageReplyInfo, ApiMessage, ApiMessageForwardInfo, ApiPeer,
} from '../../../api/types';
import type { MessageListType, ThreadId } from '../../../types/index';

import { isChatChannel } from '../../../global/helpers';
import {
  selectChat,
  selectChatMessage,
  selectDraft,
  selectEditingId,
  selectEditingMessage,
  selectEditingScheduledId,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectPeer,
  selectSender,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';

import Modal from '../../ui/Modal';
import useFlag from '../../../hooks/useFlag';
import ChatBackground from '../ChatBackground';
import Message from '../message/Message';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import { IS_ANDROID } from '../../../util/windowEnvironment';
import useAppLayout from '../../../hooks/useAppLayout';
import useDerivedSignal from '../../../hooks/useDerivedSignal';
import ListItem from '../../ui/ListItem';
import { getSelectionAsFormattedText } from '../message/helpers/getSelectionAsFormattedText';
import styles from './QuoteUpdateModal.module.scss';

type StateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  message?: ApiMessage;
  sender?: ApiPeer;
  forwardedMessages?: ApiMessage[];
  forwardedMessagesCount?: number;
  noAuthors?: boolean;
  noCaptions?: boolean;
  forwardsHaveCaptions?: boolean;
  isCurrentUserPremium?: boolean;
  senderChat?: ApiChat;
  isSenderChannel?: boolean;
  currentUserId?: string;
};

type OwnProps = {
  isOpen: boolean;
  setIsOpen: StateHookSetter<boolean>;
  onClear?: () => void;
  shouldForceShowEditing?: boolean;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
};

const QuoteUpdateModal: FC<OwnProps & StateProps> = ({
  isOpen,
  setIsOpen,
  replyInfo,
  message,
  sender,
  forwardedMessagesCount,
  noAuthors,
  noCaptions,
  forwardedMessages,
  forwardsHaveCaptions,
  shouldForceShowEditing,
  onClear,
  chatId,
  currentUserId,
  isSenderChannel,
}) => {
  const {
    resetDraftReplyInfo,
    updateDraftReplyInfo,
    focusMessage,
    changeRecipient,
    openChatOrTopicWithReplyInDraft,
    setForwardNoAuthors,
    setForwardNoCaptions,
    exitForwardMode,
  } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const isShowingReply = replyInfo && !shouldForceShowEditing;
  const isReplyWithQuote = Boolean(replyInfo?.quoteText);

  const isForwarding = Boolean(forwardedMessagesCount);

  const clearEmbedded = useLastCallback(() => {
    if (forwardedMessagesCount) {
      exitForwardMode();
    } else if (replyInfo && !shouldForceShowEditing) {
      resetDraftReplyInfo();
    }
    onClear?.();
  });

  const focusMessageFromDraft = () => {
    focusMessage({ chatId: message!.chatId, messageId: message!.id, noForumTopicPanel: true });
  };

  const buildAutoCloseMenuItemHandler = (action: NoneToVoidFunction) => {
    return () => {
      action();
    };
  };
  const handleForwardToAnotherChatClick = useLastCallback(buildAutoCloseMenuItemHandler(changeRecipient));
  const handleShowMessageClick = useLastCallback(buildAutoCloseMenuItemHandler(focusMessageFromDraft));
  const handleRemoveQuoteClick = useLastCallback(buildAutoCloseMenuItemHandler(
    () => updateDraftReplyInfo({ quoteText: undefined, quoteUnescapeText: undefined }),
  ));
  const handleChangeReplyRecipientClick = useLastCallback(buildAutoCloseMenuItemHandler(changeRecipient));
  const handleReplyInSenderChat = useLastCallback(() => {
    if (!sender) return;
    openChatOrTopicWithReplyInDraft({ chatId: sender.id });
  });

  const [isShownModal, markIsShownModal, unmarkIsShownModal] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShownModal();
    }
  }, [isOpen, markIsShownModal]);

  const handleModalCloseCb = (cb: Function) => {
    cb();
    setIsOpen(false);
  }
  const handleDoNotClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>): void => {
    clearEmbedded();
    setIsOpen(false);
  });

  const { isMobile } = useAppLayout();
  const INTERSECTION_THROTTLE_FOR_MEDIA = IS_ANDROID ? 1000 : 350;
  const INTERSECTION_MARGIN_FOR_LOADING = isMobile ? 300 : 500;
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    observe: observeIntersectionForLoading,
  } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
    margin: INTERSECTION_MARGIN_FOR_LOADING,
  });
  const observeIntersectionForReading = observeIntersectionForLoading;
  const { observe: observeIntersectionForPlaying } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE_FOR_MEDIA,
  });
  const getIsReady = useDerivedSignal(() => false, []);

  const [quoteRange, setQuoteRange] = useState<Range>()

  useEffect(() => {
    if (isOpen) {
      if (replyInfo && replyInfo?.quoteText?.text) {
        function getAllNodesAndText(element: HTMLElement | ChildNode) {
          const result: {
            node: HTMLElement | ChildNode;
            startPos: number;
            text: string | null;
            length: number;
          }[] = [];
          let currentTextContent = '';
          
          function traverse(node: HTMLElement | ChildNode) {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent;
              result.push({
                  node: node,
                  startPos: currentTextContent.length,
                  text: text,
                  length: text!.length
              });
              currentTextContent += text;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              for (let child of node.childNodes) {
                  traverse(child);
              }
            }
          }
        
          traverse(element);
          return { nodes: result, fullText: currentTextContent };
        }

        // Get combined text content and find the position of the 10th word
        const textElement = document.querySelector(`#message-${replyInfo.replyToMsgId} .text-content`) as HTMLElement;
        const textToSelect = replyInfo?.quoteUnescapeText || replyInfo?.quoteText?.text;
        if (!textToSelect) return;
        const { nodes, fullText } = getAllNodesAndText(textElement);
            
        // Find the position of the text to select
        const startPos = fullText.indexOf(textToSelect);
        if (startPos === -1) return;
        
        const endPos = startPos + textToSelect.length;
        
        // Find the nodes and offsets for selection
        let startNode, endNode, startOffset, endOffset;
        
        for (let info of nodes) {
          const nodeEndPos = info.startPos + info.length;
          
          // Find start node and offset
          if (!startNode && startPos >= info.startPos && startPos < nodeEndPos) {
            startNode = info.node;
            startOffset = startPos - info.startPos;
          }
          
          // Find end node and offset
          if (!endNode && endPos > info.startPos && endPos <= nodeEndPos) {
            endNode = info.node;
            endOffset = endPos - info.startPos;
          }
          
          if (startNode && endNode) break;
        }
        
        // Create and apply the selection
        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, startOffset as number);
          range.setEnd(endNode, endOffset as number);
          
          const selection = window.getSelection();
          selection!.removeAllRanges();
          selection!.addRange(range);
        }
      }
    }
  }, [isOpen, replyInfo?.quoteText?.text]);

  useEffect(() => {
    const handleSelection = () => {
      if (!isOpen) return;
      const selection = window.getSelection();
      const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
      setQuoteRange(selectionRange?.toString()?.trim() ? selectionRange : undefined);
    }
    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
    }
  }, [isOpen, setQuoteRange])

  const canReplyInSenderChat = sender && !isSenderChannel && chatId !== sender.id && sender.id !== currentUserId;
  if (!isOpen && !isShownModal) return null;
  return (
    <Modal
      isOpen={isOpen}
      className={styles.modalContainer}
      onClose={() => {
        setIsOpen(false);
      }}
      contentClassName='p-0'
      onCloseAnimationEnd={unmarkIsShownModal}
    >
        <h3 className={styles.modalHeader}>
          {isForwarding && <span>{forwardedMessagesCount > 1 ? oldLang('ForwardedMessageCount', forwardedMessagesCount): oldLang('lng_forward_title')}</span>}
          {isShowingReply && !isForwarding && !isReplyWithQuote && <span>{oldLang('lng_reply_options_header')}</span>}
          {isReplyWithQuote && !isForwarding && <span>{oldLang('lng_reply_options_quote')}</span>}
        </h3>

        <div 
          className={buildClassName(styles.chatContainer, 
            isForwarding && forwardsHaveCaptions && noCaptions && styles.noCaptions,
            isForwarding && noAuthors && styles.noAuthors,
            isForwarding && styles.noSelect
          )} ref={containerRef}>
          <ChatBackground />
          <div className={styles.chatContent}>
            {
              (forwardedMessages || message) && (forwardedMessages || [message]).map(item => {
                if (!item) return null;
                return (
                  <Message
                      key={item.id}
                      isPreviewMode={true}
                      message={isForwarding ? {...item, isOutgoing: true, forwardInfo: {
                        isChannelPost: false,
                        isLinkedChannelPost: false,
                        hiddenUserName: item.forwardInfo?.hiddenUserName,
                        date: item.date,
                        fromChatId: item.forwardInfo?.fromChatId || item.chatId,
                        fromMessageId: item.forwardInfo?.fromMessageId || item.id,
                        fromId: item.forwardInfo?.fromId || item.senderId,
                      }} : item}
                      observeIntersectionForBottom={observeIntersectionForReading}
                      observeIntersectionForLoading={observeIntersectionForLoading}
                      observeIntersectionForPlaying={observeIntersectionForPlaying}
                      noAvatars={false}
                      withAvatar={true}
                      withSenderName={true}
                      threadId={1}
                      messageListType={'thread'}
                      noComments={false}
                      noReplies={false}
                      appearanceOrder={1}
                      isJustAdded={true}
                      isFirstInGroup={false}
                      isLastInGroup={true}
                      isFirstInDocumentGroup={true}
                      isLastInDocumentGroup={true}
                      isLastInList={true}
                      memoFirstUnreadIdRef={{current: undefined}}
                      onIntersectPinnedMessage={() => {}}
                      getIsMessageListReady={getIsReady}
                    />
                )
              })
            }
          </div>
        </div>
        {isForwarding && (
          <>
            {noAuthors ? <ListItem
              icon="user"
              key="user"
              onClick={() => setForwardNoAuthors({
                noAuthors: false,
              })}
            >
              {oldLang(forwardedMessagesCount > 1 ? 'ShowSenderNames' : 'ShowSendersName')}
            </ListItem> : <ListItem
              icon="delete-user"
              key="delete-user"
              onClick={() => setForwardNoAuthors({
                noAuthors: true,
              })}
            >
              {oldLang(forwardedMessagesCount > 1 ? 'HideSenderNames' : 'HideSendersName')}
            </ListItem>}
           
            {forwardsHaveCaptions && (
              <>
                {noCaptions ? <ListItem
                  icon="move-caption-down"
                  key="caption-show"
                  onClick={() => setForwardNoCaptions({
                    noCaptions: false,
                  })}
                >
                  {oldLang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.ShowCaption' : 'ShowCaption')}
                </ListItem> :
                <ListItem
                  icon="move-caption-up"
                  key="caption-hide"
                  onClick={() => setForwardNoCaptions({
                    noCaptions: true,
                  })}
                >
                  {oldLang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.HideCaption' : 'HideCaption')}
                </ListItem>}
              </>
            )}
            <ListItem icon="replace" onClick={e => handleModalCloseCb(handleForwardToAnotherChatClick.bind(e))}>
              {oldLang('ForwardAnotherChat')}
            </ListItem>
            <ListItem destructive icon="delete" onClick={e => handleModalCloseCb(handleDoNotClick)}>
              {oldLang('DoNotForward')}
            </ListItem>
          </>
        )}
        {isShowingReply && !isForwarding && (
          <>
            <ListItem 
              icon="show-message"
              onClick={e => handleModalCloseCb(handleShowMessageClick.bind(e))}
            >
              {oldLang('Message.Context.Goto')}
            </ListItem>
            {isReplyWithQuote && (
              <ListItem 
                icon="remove-quote"
                onClick={handleRemoveQuoteClick}
              >
                {oldLang('RemoveQuote')}
              </ListItem>
            )}
            {canReplyInSenderChat && (
              <ListItem  icon="user" onClick={e => handleModalCloseCb(handleReplyInSenderChat.bind(e))}>
                {lang('ReplyInPrivateMessage')}
              </ListItem>
            )}
            <ListItem  icon="replace" onClick={e => handleModalCloseCb(handleChangeReplyRecipientClick.bind(e))}>
              {oldLang('ReplyToAnotherChat')}
            </ListItem>
            <ListItem destructive icon="delete" onClick={e => handleModalCloseCb(handleDoNotClick)}>
              {oldLang('DoNotReply')}
            </ListItem>
          </>
        )}
        {/* Forward buttons: Hide sender name / Change recipient / do not forward */}

        <ListItem disabled focus className={styles.sectionHelp}>
          {isForwarding ? <span>{oldLang(forwardedMessagesCount > 1 ? 'lng_forward_many_about' : 'lng_forward_about')}</span> : <span>{oldLang('lng_reply_about_quote')}</span>}
        </ListItem>

        <div className={styles.buttonGroup}>
          <Button
            className="confirm-dialog-button"
            isText
            size="smaller"
            onClick={() => {
              setIsOpen(false);
            }}>
              {lang('Cancel')}
          </Button>
          <Button size="smaller" className="confirm-dialog-button" isText onClick={() => {
            if (quoteRange) {
              const quoteText = getSelectionAsFormattedText(quoteRange);
              updateDraftReplyInfo({
                quoteText: quoteText?.text,
                quoteUnescapeText: quoteText?.unescapeText.text,
              });
            } else if (replyInfo?.quoteText?.text) {
              handleRemoveQuoteClick()
            }
            setIsOpen(false);
          }}>
            {!quoteRange ? oldLang('lng_settings_save') : oldLang('lng_reply_quote_selected')}
          </Button>
        </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    shouldForceShowEditing, chatId, threadId, messageListType,
  }): StateProps => {
    const {
      forwardMessages: {
        fromChatId, toChatId, messageIds: forwardMessageIds, noAuthors, noCaptions,
      },
    } = selectTabState(global);

    const editingId = messageListType === 'scheduled'
      ? selectEditingScheduledId(global, chatId)
      : selectEditingId(global, chatId, threadId);
    const isForwarding = toChatId === chatId;
    const forwardedMessages = forwardMessageIds?.map((id) => {
      const msg = selectChatMessage(global, fromChatId!, id)!;
      if (!msg.senderId && !msg.forwardInfo?.hiddenUserName) {
        // for showing username in preview mode
        const chat = selectChat(global, msg.chatId);
        const isChannel = chat?.type === 'chatTypeChannel';
        const sender = selectSender(global, msg);
        const username = chat?.usernames?.[0]?.username;
        if (!msg.forwardInfo) msg.forwardInfo = {} as ApiMessageForwardInfo;
        if (isChannel) {
          msg.forwardInfo.fromId = sender?.id;
          msg.forwardInfo.channelPostId = msg.id;
          msg.forwardInfo.isChannelPost = isChannel;
        } else if (username) {
          msg.forwardInfo.hiddenUserName = chat?.usernames?.[0]?.username;
        }
      }
      return msg;
    });
    const draft = selectDraft(global, chatId, threadId);
    const replyInfo = draft?.replyInfo;
    const replyToPeerId = replyInfo?.replyToPeerId;
    const senderChat = replyToPeerId ? selectChat(global, replyToPeerId) : undefined;

    let message: ApiMessage | undefined;
    if (editingId) {
      message = selectEditingMessage(global, chatId, threadId, messageListType);
    } else if (isForwarding && forwardMessageIds!.length === 1) {
      message = forwardedMessages?.[0];
    } else if (replyInfo && !shouldForceShowEditing) {
      message = selectChatMessage(global, replyInfo.replyToPeerId || chatId, replyInfo.replyToMsgId);
    }

    let sender: ApiPeer | undefined;

    if (isForwarding) {
      if (message) {
        sender = selectForwardedSender(global, message);
        if (!sender) {
          sender = selectSender(global, message);
        }
      }
      if (!sender) {
        sender = selectPeer(global, fromChatId!);
      }
    } else if (replyInfo && message && !shouldForceShowEditing) {
      const { forwardInfo } = message;
      const isChatWithSelf = selectIsChatWithSelf(global, chatId);
      if (forwardInfo && (forwardInfo.isChannelPost || isChatWithSelf)) {
        sender = selectForwardedSender(global, message);
      }

      if (!sender && (!forwardInfo?.hiddenUserName || Boolean(replyInfo.quoteText))) {
        sender = selectSender(global, message);
      }
    }

    const chat = sender && selectChat(global, sender.id);
    const isSenderChannel = chat && isChatChannel(chat);

    const forwardsHaveCaptions = forwardedMessages?.some((forward) => (
      forward?.content.text && Object.keys(forward.content).length > 1
    ));

    return {
      replyInfo,
      message,
      sender,
      forwardedMessages,
      forwardedMessagesCount: isForwarding ? forwardMessageIds!.length : undefined,
      noAuthors,
      noCaptions,
      forwardsHaveCaptions,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      senderChat,
      currentUserId: global.currentUserId,
      isSenderChannel,
    };
  },
)(QuoteUpdateModal));
