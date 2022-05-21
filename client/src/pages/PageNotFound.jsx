import React from 'react';
import Header from '../components/Header/Header.jsx';
import styled from 'styled-components';

function PageNotFound({title, gasInfoHead, fuelValue}) {
  return (
    <>
      <Header title={title} gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <Wrapper>
      <h3>ERROR 404</h3>
      <h4>Diese Seite existiert nicht</h4>
      </Wrapper>
    </>
  );
}

const Wrapper = styled.main`
text-align: center;
`;

export default PageNotFound;
