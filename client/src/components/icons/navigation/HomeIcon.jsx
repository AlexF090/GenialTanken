import React from 'react';
import { IconContext } from 'react-icons';
import { MdHome } from 'react-icons/md';

function HomeIcon() {
  return (
    <IconContext.Provider value={{ size: '3em' }}>
      <>
        <MdHome />
      </>
    </IconContext.Provider>
  );
}

export default HomeIcon;
