import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import SettingsIcon from '../icons/settings_icon.svg';

function Header({ title }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <NavigationLink role="list" to="/settings">
        <li>
          <img src={SettingsIcon} alt="Einstellungs Icon" />
          <figcaption>Einstellungen</figcaption>
        </li>
      </NavigationLink>
    </>
  );
}

const PageTitle = styled.h1`
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

const NavigationLink = styled(NavLink)`
  text-decoration: none;
  color: #2196f3;
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

export default Header;
