import React from 'react'
import styled from 'styled-components';

function Header() {
  return (
    <StyledHeader>Header</StyledHeader>
  )
}

const StyledHeader = styled.h1`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 6.25rem;;
  position: fixed;
  top: 0;
  border: 1px solid black;
  
  background-color: #ffffff;
`;

export default Header;