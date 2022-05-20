import React from 'react';
import styled from 'styled-components';

const OpeningTimes = ({ currentStation }) => {
  const isOpen = currentStation.isOpen;
  const openingDay = currentStation.openingTimes;

  return (
    <>
      <OpenStatus>
        {isOpen ? 'Die Tankstelle ist geöffnet.' : 'Die Tankstelle hat leider gesschlossen.'}
      </OpenStatus>

      <Week role="list">
        <Day>
          Montag:
          <time>
            {' '}
            {openingDay.monday[0]?.opening} - {openingDay.monday[0]?.closing}
          </time>
        </Day>
        <Day>
          Dienstag:
          <time>
            {' '}
            {openingDay.tuesday[0]?.opening} - {openingDay.tuesday[0]?.closing}
          </time>
        </Day>
        <Day>
          Mittwoch:
          <time>
            {' '}
            {openingDay.wednesday[0]?.opening} - {openingDay.wednesday[0]?.closing}
          </time>
        </Day>
        <Day>
          Donnerstag:
          <time>
            {' '}
            {openingDay.thursday[0]?.opening} - {openingDay.thursday[0]?.closing}
          </time>
        </Day>
        <Day>
          Freitag:
          <time>
            {' '}
            {openingDay.friday[0]?.opening} - {openingDay.friday[0]?.closing}
          </time>
        </Day>
        <Day>
          Samstag:
          <time>
            {' '}
            {openingDay.saturday[0]?.opening} - {openingDay.saturday[0]?.closing}
          </time>
        </Day>
        <Day>
          Sonntag:
          <time>
            {' '}
            {openingDay.sunday[0]?.opening} - {openingDay.sunday[0]?.closing}
          </time>
        </Day>
      </Week>
    </>
  );
};

const OpenStatus = styled.h2`
  font-weight: bold;
  font-size: 0.9rem;
  align-self: center;
`;

const Week = styled.ul`
  align-items: center;
  list-style: none;
`;

const Day = styled.li`
  margin: 0.2em 0;
  font-size: 0.8rem;
  border-top: 1px solid #e0e0e0;
`;

export default OpeningTimes;
