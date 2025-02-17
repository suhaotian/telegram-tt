import { getGlobal } from '../../global';

import { ApiMessageEntity, ApiMessageEntityTypes, type ApiChatFolder, type ApiMessageEntityCustomEmoji } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { Dispatch, StateReducer } from '../useReducer';

import { selectChat } from '../../global/selectors';
import { omit, pick } from '../../util/iteratees';
import useReducer from '../useReducer';

export type FolderChatType = {
  icon: IconName;
  title: string;
  key: keyof Pick<ApiChatFolder, (
    'contacts' | 'nonContacts' | 'groups' | 'channels' | 'bots' |
    'excludeMuted' | 'excludeArchived' | 'excludeRead'
  )>;
};

const INCLUDE_FILTER_FIELDS: Array<keyof FolderIncludeFilters> = [
  'includedChatIds', 'bots', 'channels', 'groups', 'contacts', 'nonContacts',
];
const EXCLUDE_FILTER_FIELDS: Array<keyof FolderExcludeFilters> = [
  'excludedChatIds', 'excludeArchived', 'excludeMuted', 'excludeRead',
];

export function selectChatFilters(state: FoldersState, mode: 'included' | 'excluded', selectTemp?: boolean) {
  let selectedChatIds: string[] = [];
  let selectedChatTypes: FolderChatType['key'][] = [];

  if (mode === 'included') {
    const {
      includedChatIds,
      ...includeFilters
    } = selectTemp
      ? state.includeFilters || {}
      : pick(
        state.folder,
        INCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = includedChatIds || [];
    selectedChatTypes = (Object.keys(includeFilters) as Array<keyof typeof includeFilters>)
      .filter((key) => Boolean(includeFilters[key]));
  } else {
    const {
      excludedChatIds,
      ...excludeFilters
    } = selectTemp
      ? state.excludeFilters || {}
      : pick(
        state.folder,
        EXCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = excludedChatIds || [];
    selectedChatTypes = (Object.keys(excludeFilters) as Array<keyof typeof excludeFilters>)
      .filter((key) => Boolean(excludeFilters[key]));
  }

  const global = getGlobal();
  const existingSelectedChatIds = selectedChatIds.filter((id) => selectChat(global, id));

  return {
    selectedChatIds: existingSelectedChatIds,
    selectedChatTypes,
  };
}

function getSuggestedFolderName(includeFilters?: FolderIncludeFilters) {
  if (includeFilters) {
    const {
      includedChatIds,
      ...filters
    } = includeFilters;

    if (
      Object.values(filters).filter(Boolean).length > 1
      || (includedChatIds?.length)
    ) {
      return '';
    }

    if (filters.bots) {
      return 'Bots';
    } else if (filters.groups) {
      return 'Groups';
    } else if (filters.channels) {
      return 'Channels';
    } else if (filters.contacts) {
      return 'Contacts';
    } else if (filters.nonContacts) {
      return 'Non-Contacts';
    }
  }

  return '';
}

type FolderIncludeFilters = Pick<ApiChatFolder, (
  'includedChatIds' | 'bots' | 'channels' | 'groups' | 'contacts' | 'nonContacts'
)>;
type FolderExcludeFilters = Pick<ApiChatFolder, 'excludedChatIds' | 'excludeArchived' | 'excludeMuted' | 'excludeRead'>;

export type FoldersState = {
  mode: 'create' | 'edit';
  isLoading?: boolean;
  isTouched?: boolean;
  error?: string;
  folderId?: number;
  chatFilter: string;
  folder: Omit<ApiChatFolder, 'id' | 'description'>;
  includeFilters?: FolderIncludeFilters;
  excludeFilters?: FolderExcludeFilters;
};
export type FoldersActions = (
  'setTitle' | 'setEmoticon' | 'toggleTitleAnimation' | 'saveFilters' | 'editFolder' | 'reset' | 'setChatFilter' | 'setIsLoading' | 'setError' |
  'editIncludeFilters' | 'editExcludeFilters' | 'setIncludeFilters' | 'setExcludeFilters' | 'setIsTouched' |
  'setFolderId' | 'setIsChatlist'
  );
export type FolderEditDispatch = Dispatch<FoldersState, FoldersActions>;

const INITIAL_STATE: FoldersState = {
  mode: 'create',
  chatFilter: '',
  folder: {
    title: { text: '' },
    includedChatIds: [],
    excludedChatIds: [],
  },
};

const foldersReducer: StateReducer<FoldersState, FoldersActions> = (
  state,
  action,
): FoldersState => {
  state.folder.title.entities;
  switch (action.type) {
    case 'toggleTitleAnimation':
      return {
        ...state,
        folder: {
          ...state.folder,
          noTitleAnimations: state.folder.noTitleAnimations ? undefined : true,
        },
        isTouched: true,
      };
    case 'setTitle':
      {let titleText = action.payload;
      let entities: ApiMessageEntity[] = state.folder.title.entities ? [...state.folder.title.entities] : [];
      let lastCustomEmojiIndex = -1;
      let customEmojiEntity: ApiMessageEntityCustomEmoji | undefined;
      entities?.forEach((item, index) => {
        if (item.type === ApiMessageEntityTypes.CustomEmoji) {
          customEmojiEntity = item;
          lastCustomEmojiIndex = index;
        }
      });
      if (lastCustomEmojiIndex >= 0) entities.splice(lastCustomEmojiIndex, 1);
      const emoticon = state.folder.emoticon || '📁';
      return {
        ...state,
        folder: {
          ...state.folder,
          title: !customEmojiEntity ? { ...state.folder.title, text: action.payload } : {
            ...state.folder.title,
            text: titleText + emoticon,
            entities: [...entities, {
              type: ApiMessageEntityTypes.CustomEmoji,
              documentId: customEmojiEntity.documentId,
              offset: titleText.length,
              length: emoticon.length,
            }]
          },
        },
        isTouched: true,
      };}
    case 'setEmoticon':
      {let titleText = state.folder.title.text;
      let entities: ApiMessageEntity[] = [];
      let customEmojiEntity: ApiMessageEntityCustomEmoji | undefined;
      state.folder.title.entities?.forEach(item => {
        if (item.type === ApiMessageEntityTypes.CustomEmoji) customEmojiEntity = item;
        else entities.push(item);
      });
      if (customEmojiEntity) {
        const { length, offset } = customEmojiEntity;
        titleText = titleText.slice(0, offset) + titleText.slice(offset+length,);
      }
      return {
        ...state,
        folder: {
          ...state.folder,
          emoticon: action.payload.emoticon,
          title: action.payload.documentId ? {
            ...state.folder.title,
            text: titleText + action.payload.emoticon,
            entities: [...entities, {
              type: ApiMessageEntityTypes.CustomEmoji,
              documentId: action.payload.documentId,
              offset: titleText.length,
              length: action.payload.emoticon.length,
            }]
          } : {
            ...state.folder.title,
            text: titleText,
            entities,
          },
        },
        isTouched: true,
      };}
    case 'setFolderId':
      return {
        ...state,
        folderId: action.payload,
        mode: 'edit',
      };
    case 'editIncludeFilters':
      return {
        ...state,
        includeFilters: pick(
          state.folder,
          INCLUDE_FILTER_FIELDS,
        ),
      };
    case 'editExcludeFilters':
      return {
        ...state,
        excludeFilters: pick(
          state.folder,
          EXCLUDE_FILTER_FIELDS,
        ),
      };
    case 'setIncludeFilters':
      return {
        ...state,
        includeFilters: action.payload,
        chatFilter: '',
      };
    case 'setExcludeFilters':
      return {
        ...state,
        excludeFilters: action.payload,
        chatFilter: '',
      };
    case 'saveFilters':
      if (state.includeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, INCLUDE_FILTER_FIELDS),
            title: state.folder.title ? state.folder.title : { text: getSuggestedFolderName(state.includeFilters) },
            ...state.includeFilters,
          },
          includeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else if (state.excludeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, EXCLUDE_FILTER_FIELDS),
            ...state.excludeFilters,
          },
          excludeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else {
        return state;
      }
    case 'editFolder': {
      const { id: folderId, description, ...folder } = action.payload;

      return {
        mode: 'edit',
        folderId,
        folder,
        chatFilter: '',
      };
    }
    case 'setChatFilter': {
      return {
        ...state,
        chatFilter: action.payload,
      };
    }
    case 'setIsTouched': {
      return {
        ...state,
        isTouched: action.payload,
      };
    }
    case 'setIsLoading': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case 'setError': {
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    }
    case 'setIsChatlist':
      return {
        ...state,
        folder: {
          ...state.folder,
          isChatList: action.payload,
        },
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
};

const useFoldersReducer = () => {
  return useReducer(foldersReducer, INITIAL_STATE);
};

export default useFoldersReducer;
