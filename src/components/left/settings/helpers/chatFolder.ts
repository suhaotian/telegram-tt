import { ApiMessageEntity, ApiMessageEntityCustomEmoji, ApiMessageEntityTypes } from '../../../../api/types';
import { FoldersState } from '../../../../hooks/reducers/useFoldersReducer';

export function getFolderState(folder: FoldersState['folder']) {
  let titleText = folder.title.text;
  let entities: ApiMessageEntity[] = folder.title.entities ? [...folder.title.entities] : [];
  let lastCustomEmojiIndex = -1;
  let customEmojiEntity: ApiMessageEntityCustomEmoji | undefined;
  customEmojiEntity = entities?.filter(item => item.type === ApiMessageEntityTypes.CustomEmoji).pop();
  if (customEmojiEntity) {
    const { length, offset } = customEmojiEntity;
    titleText = titleText.slice(0, offset) + titleText.slice(offset+length,);
  }
  if (lastCustomEmojiIndex >= 0) entities.splice(lastCustomEmojiIndex, 1);

  return { titleText, entities, customEmojiEntity }
}