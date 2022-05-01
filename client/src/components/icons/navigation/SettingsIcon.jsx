import React from 'react';
import { IconContext } from 'react-icons';
import { MdSettings } from 'react-icons/md';

function SettingsIcon() {
  return (
    <IconContext.Provider value={{ color: 'lightgrey', size: '3em' }}>
      <>
        <MdSettings />
      </>
    </IconContext.Provider>
  );
}

export default SettingsIcon;
