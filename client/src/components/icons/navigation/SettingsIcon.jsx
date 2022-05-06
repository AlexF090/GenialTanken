import React from 'react';
import { IconContext } from 'react-icons';
import { MdSettings } from 'react-icons/md';

function SettingsIcon() {
  return (
    <IconContext.Provider value={{ size: '3em' }}>
      <>
        <MdSettings />
      </>
    </IconContext.Provider>
  );
}

export default SettingsIcon;
