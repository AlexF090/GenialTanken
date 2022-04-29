import React from 'react';
import GasStation from '../components/GasStation.jsx';
import Header from '../components/Header.jsx';

function LandingPage({title}) {
  return (
    <>
      <Header title= {title} />
      <GasStation />
    </>
  );
}
export default LandingPage;
