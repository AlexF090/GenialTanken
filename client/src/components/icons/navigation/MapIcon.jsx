import React from 'react';
import styled from 'styled-components';
import { RiRoadMapFill } from 'react-icons/ri';

function MapIcon() {
  return (
    <>
      <RoadMapIcon />
    </>
  );
}

const RoadMapIcon = styled(RiRoadMapFill)`
  font-size: 3em;
`;

export default MapIcon;
