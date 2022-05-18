import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import SettingsIcon from './icons/navigation/SettingsIcon.jsx';
import GasInfoHead from '../components/GasInfoHead.jsx';

function Header({ gasInfoHead, fuelValue, title }) {
  return (
    <HeaderContainer>
      <GasInfoHead gasInfoHead={gasInfoHead} fuelValue={fuelValue} />
      <PageTitle>{title}</PageTitle>
      <HeaderLink role="list" to="/settings">
        <SettingsIcon />
        <p>Einstellungen</p>
      </HeaderLink>
    </HeaderContainer>
  );
}

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 6.25rem;
  position: fixed;
  top: 0;
  border-bottom: 1px solid black;
  background-color: #ffffff;
  z-index: 20;
`;

const PageTitle = styled.h1`
  text-align: center;
`;

const HeaderLink = styled(NavLink)`
  text-decoration: none;
  color: #2196f3;
  position: fixed;
  right: 1%;
  top: 22px;
  list-style: none;
  text-align: center;
  &.active {
    text-decoration: none;
    color: #0367b4;
  }
`;

export default Header;
