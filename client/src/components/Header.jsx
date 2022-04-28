import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import SettingsIcon from '../icons/settings_icon.svg';

function Header() {
  return (
    <>
      <StyledHeader>Start</StyledHeader>
      <NavLinkStyled to="/Einstellungen">
        <li>
          <Icon src={SettingsIcon} alt="Einstellungs Icon" />
          <figcaption>Einstellungen</figcaption>
        </li>
      </NavLinkStyled>
    </>
  );
}

const StyledHeader = styled.h1`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 6.25rem;
  position: fixed;
  top: 0;
  border-bottom: 1px solid black;

  background-color: #ffffff;
`;

const NavLinkStyled = styled(NavLink)`
  text-decoration: none;
  color: #2196f3;
  cursor: pointer;
  position: fixed;
  right: 1%;
  top: 22px;
  list-style: none;
  text-align: center;
  &.active {
    text-decoration: none;
    color: black;
  }
`;

const Icon = styled.img`
  width: 2rem;
`;

// const SettingButton = styled(Link)`
//   all: unset;
//   cursor: pointer;
//   position: absolute;
//   right: 5%;
//   top: 22px;
//   list-style: none;
//  text-align: center;
// `

export default Header;
