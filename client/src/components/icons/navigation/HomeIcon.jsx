import React from 'react';
import styled from 'styled-components';
import { MdHome } from 'react-icons/md';

function HomeIcon() {
  return (
    <>
      <StarIcon />
    </>
  );
}

const StarIcon = styled(MdHome)`
  font-size: 3em;
`;

export default HomeIcon;
