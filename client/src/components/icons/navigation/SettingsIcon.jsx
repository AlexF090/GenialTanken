import React from 'react';
import styled from 'styled-components';
import { IconContext } from 'react-icons';
import { MdSettings } from 'react-icons/md';

function SettingsIcon() {
  return (
    <>
      <SetIcon />
    </>
  );
}

const SetIcon = styled(MdSettings)`
  grid-area: settingsIcon;
  justify-self: center;
  align-self: center;
  font-size: 3em;
`;

export default SettingsIcon;
