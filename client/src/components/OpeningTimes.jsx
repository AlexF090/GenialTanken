import React from 'react';
import styled from 'styled-components';

const OpeningTimes = ({ currentStation }) => {
  const isOpen = currentStation.isOpen;
  const openingDay = currentStation.openingTimes;
  console.log(openingDay.monday[0].opening);

  return (
    <>
      <h2>{isOpen ? 'Die Tankstelle ist geöffnet' : 'Die Tankstelle hat leider gesschlossen'}</h2>
      <Days>
        Montag: {openingDay.monday[0].opening} - {openingDay.monday[0].closing}{' '}
      </Days>
      <Days>
        Dienstag: {openingDay.tuesday[0].opening} - {openingDay.tuesday[0].closing}{' '}
      </Days>
      <Days>
        Mittwoch: {openingDay.wednesday[0].opening} - {openingDay.wednesday[0].closing}{' '}
      </Days>
      <Days>
        Donnerstag: {openingDay.thursday[0].opening} - {openingDay.thursday[0].closing}{' '}
      </Days>
      <Days>
        Freitag: {openingDay.friday[0].opening} - {openingDay.friday[0].closing}{' '}
      </Days>
      <Days>
        Samstag: {openingDay.saturday[0].opening} - {openingDay.saturday[0].closing}{' '}
      </Days>
      <Days>
        Sonntag: {openingDay.sunday[0].opening} - {openingDay.sunday[0].closing}{' '}
      </Days>
    </>
  );
};

const Days = styled.li`
  list-style: none;
`;

export default OpeningTimes;
