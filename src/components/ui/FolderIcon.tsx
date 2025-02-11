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

const FolderIcon: FC<{ folderIcon?: string; folderId?: number }> = ({
  folderIcon = '📁',
  folderId,
}) => {
  const folderIconName = folderId === ALL_FOLDER_ID ? 'folders_chats' : localFolderIconMaps[folderIcon];
  if (folderIconName) return <Icon name={folderIconName} className='local' />;

  if (folderIcon && /^\d+$/.test(folderIcon))
    return <CustomEmoji documentId={folderIcon} size={32} />;

  const replaceEmoji = folderIcon && renderText(folderIcon);
  if (folderIcon && replaceEmoji !== folderIcon)
    return <span className='render-emoji' data-emoji={folderIcon}>{replaceEmoji}</span>;

  return <span className='emoji' data-emoji={folderIcon}>{folderIcon}</span>;
};

export default FolderIcon;
