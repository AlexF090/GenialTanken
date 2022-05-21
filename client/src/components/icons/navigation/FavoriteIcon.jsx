import React from 'react';
import styled from 'styled-components';
import { MdStar } from 'react-icons/md';

function FavoriteIcon() {
  return (
    <>
      <StarIcon />
    </>
  );
}

const StarIcon = styled(MdStar)`
  font-size: 3em;
`;

export default FavoriteIcon;
