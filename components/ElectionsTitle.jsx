import React, { useContext } from 'react';
import Head from 'next/head';

import DataProvider from '../api/DataProvider';
import { useRouter } from 'next/router';

const ElectionsTitle = () => {
  const router = useRouter();
  const { elections } = useContext(DataProvider);

  const electionId = router.query.id;
  let title = 'All Elections';
  let subtitle = '';

  if (electionId && elections) {
    const { name, status } = elections.find(e => e.id === electionId);

    title = name;

    if (status === 'VOTING') subtitle = 'Vote candidates';
    else if (status === 'NOMINATING') subtitle = 'nominate candidates';
    else subtitle = 'See results';

    // subtitle += ' for the election';
  }

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <div className="text-center text-white mt-6">
        <p className="uppercase tracking-widest text-xs">&nbsp;{subtitle}</p>
        <h1 className="text-6xl font-light leading-none">{title}</h1>
      </div>
    </>
  );
};

export default ElectionsTitle;
