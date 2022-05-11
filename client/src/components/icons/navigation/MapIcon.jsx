import React from 'react';
import { IconContext } from 'react-icons';
import { RiRoadMapFill } from 'react-icons/ri';

function MapIcon() {
  return (
    <IconContext.Provider value={{ size: '3em' }}>
      <>
        <RiRoadMapFill />
      </>
    </IconContext.Provider>
  );
}

export default MapIcon;
