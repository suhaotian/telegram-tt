import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './FolderIconPicker';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const FolderIconPicker: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const FolderIconPickerMenu = useModuleLoader(Bundles.Extra, 'FolderIconPicker', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return FolderIconPickerMenu ? <FolderIconPickerMenu {...props} /> : undefined;
};

export default FolderIconPicker;
