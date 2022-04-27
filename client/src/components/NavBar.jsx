import React from 'react';
import styled from 'styled-components';
import StartIcon from '../icons/start_icon.svg'
import MapIcon from '../icons/map_icon.svg'
import SettingsIcon from '../icons/settings_icon.svg'
import FavoriteIcon from '../icons/favorite_icon.svg'



function NavBar() {
  return (
    <StyledNavBar>
      <StyledUnorderedList>
        <StyledListItem><img src={StartIcon} alt="Start Icon" /><figcaption>Start</figcaption></StyledListItem>
        <StyledListItem><img src={MapIcon} alt="Karten Icon" /><figcaption>Karte</figcaption></StyledListItem>
        <StyledListItem><img src={SettingsIcon} alt="Einstellungs Icon" /><figcaption>Einstellungen</figcaption></StyledListItem>
        <StyledListItem><img src={FavoriteIcon} alt="Favoriten Icon" /><figcaption>Favoriten</figcaption></StyledListItem>
      </StyledUnorderedList>
    </StyledNavBar>
  );
}

const StyledNavBar = styled.nav`
  display: flex;
  width: 100%;
  height: 4.6875rem;
  position: fixed;
  bottom: 0;
  border: 1px solid black;
  
  background-color: #ffffff;
`;

const StyledUnorderedList = styled.ul`
width: 100%;
text-align: center;
display: flex;
flex-direction: row;
align-items: center;
justify-content: space-around;
color: #2196F3;
`;

const StyledListItem = styled.li`
list-style: none;

`;

export default NavBar;
