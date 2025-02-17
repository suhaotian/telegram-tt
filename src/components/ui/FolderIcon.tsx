import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';
import { ALL_FOLDER_ID } from '../../config';
import { FontIconName } from '../../types/icons/font';
import CustomEmoji from '../common/CustomEmoji';
import renderText from '../common/helpers/renderText';
import Icon from '../common/icons/Icon';

export const folderIconsName: {emoji: string; iconName: FontIconName}[] = [
  {emoji: '💬', iconName: 'folders_chats'},
  {emoji: '✅', iconName: 'folders_chat'},
  {emoji: '📢', iconName: 'folders_channel'},
  {emoji: '👤', iconName: 'folders_user'},
  {emoji: '👥', iconName: 'folders_group'},
  {emoji: '🤖', iconName: 'folders_bot'},
  {emoji: '⭐', iconName: 'folders_star'},
  {emoji: '📁', iconName: 'folders_folder'},
];

const localFolderIconMaps = folderIconsName.reduce((prev, curr) => {
    prev[curr.emoji] = curr.iconName;
    return prev;
  }, {} as Record<string, FontIconName>);

const FolderIcon: FC<{ folderIcon?: string; documentId?: string; folderId?: number; animation?: boolean }> = ({
  folderIcon = '📁',
  documentId,
  folderId,
  animation,
}) => {
  if (documentId)
    return <CustomEmoji documentId={documentId} size={32} noPlay={animation} />;

  const folderIconName = folderId === ALL_FOLDER_ID ? 'folders_chats' : localFolderIconMaps[folderIcon];
  if (folderIconName) return <Icon name={folderIconName} className='local' />;

  const replaceEmoji = folderIcon && renderText(folderIcon);
  if (folderIcon && replaceEmoji !== folderIcon)
    return <span className='render-emoji'>{replaceEmoji}</span>;

  return <span className='emoji'>{folderIcon}</span>;
};

export default FolderIcon;
