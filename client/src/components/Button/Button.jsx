import React from 'react';
import styled from 'styled-components';

function Button({ myFunction, buttonTitle }) {
  return (
    <GlobalButton
      onClick={myFunction}
      aria-label={typeof buttonTitle === 'string' ? buttonTitle : 'aktualisieren'}>
      {buttonTitle}
    </GlobalButton>
  );
}

const GlobalButton = styled.button`
  padding: 0.5rem;
  color: white;
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.25), inset 0px 0px 2px rgba(0, 0, 0, 0.25);
  background-color: #2196f3;
  border-radius: 10px;
  border: none;
  font-size: 1.25rem;
  grid-area: saveButton;
  @media only screen and (min-width: 600px) {
    width: 200px;
  }
  &:active {
    background-color: #002c76;
  }
`;
export default Button;
