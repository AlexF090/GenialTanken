import React from 'react';
import { IconContext } from 'react-icons';
import { MdStarOutline } from 'react-icons/md';

function FavoriteIconDeactivated() {
  return (
    <IconContext.Provider value={{ color: 'lightgrey', size: '3em' }}>
      <>
        <MdStarOutline />
      </>
    </IconContext.Provider>
  );
}

export default FavoriteIconDeactivated;
