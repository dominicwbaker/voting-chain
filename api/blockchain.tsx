import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  createContext,
  useReducer
} from 'react';
import shajs from 'sha.js';
import io from 'socket.io-client';

// @ts-ignore
import Miner from './miner.worker';
import ec from './curve';
import DataContext from './DataProvider';
import {
  blockchainReducer,
  genesisBlock,
  hashVote,
  getLongestChain,
  broadcastToNetwork,
  castVote
} from './utils';

const socket = io('localhost:8500');

//====================
// Interfaces
//====================

export interface VoteInfo {
  to: string;
  electionId: string;
  position: string;
}

export interface Vote extends VoteInfo {
  from: string;
  timestamp: number;
  signature: string;
}

export interface Block {
  hash: string;
  previousHash: string;
  nonce: number;
  vote: Vote;
}

//====================
// Context
//====================

type ContextProps = {
  blockchain: Block[];
  miningQueue: Vote[];
  castVote: Function;
};

const BlockchainContext = createContext<Partial<ContextProps>>({});
export default BlockchainContext;

//====================
// Provider
//====================

export const BlockchainProvider = ({ children }) => {
  const { currentUser, users } = useContext(DataContext);

  const [miningQueue, setMiningQueue] = useState<Array<Vote>>([]);
  const [isMining, setIsMining] = useState(false);

  const [blockchain, dispatch] = useReducer(blockchainReducer, [genesisBlock]);
  const chainPreviousHashRef = useRef(genesisBlock.hash);

  useEffect(function() {
    fetch('http://localhost:8500/blockchain')
      .then(res => res.json())
      .then(data => dispatch({ type: 'UPDATE', value: data }));
  }, []);

  /**
   * Send votes to mining queue
   * Check that signature matches with public key
   */
  useEffect(() => {
    socket.on('MINE', (vote: Vote) => {
      const fromUser = users.find(user => user.id === vote.from);
      const publicKey = ec.keyFromPublic(fromUser.publicKey, 'hex');

      if (publicKey.verify(hashVote(vote), vote.signature)) {
        setMiningQueue(currentQueue => [...currentQueue, vote]);
      }
    });

    return () => {
      socket.off('MINE');
    };
  }, []);

  /**
   * Listen to mining queue
   * Mine votes one by one
   * Broadcast votes to network
   */
  useEffect(() => {
    if (miningQueue.length === 0 || isMining) return;

    const miner = new Miner();
    const transaction = miningQueue[0];

    miner.postMessage({
      vote: transaction,
      previousHash: chainPreviousHashRef.current
    });

    setIsMining(true);

    miner.addEventListener('message', ({ data: block }: { data: Block }) => {
      // Broadcast to network that this is a new block
      broadcastToNetwork(JSON.stringify(block), 'BLOCK').then(() => {
        setMiningQueue(miningQueue.splice(1, miningQueue.length));
        setIsMining(false);
      });
    });
  }, [miningQueue, isMining]);

  /**
   * Listen on socket for new blocks
   * Add them to the chain
   */
  useEffect(() => {
    socket.on('BLOCK', (block: Block) => {
      dispatch({ type: 'UPDATE', value: [block] });
    });

    return () => {
      socket.off('BLOCK');
    };
  }, []);

  /**
   * Update previous hash for next block,
   * everytime the blockchain is updated
   */
  useEffect(() => {
    chainPreviousHashRef.current = getLongestChain(blockchain)[0].hash;
  }, [blockchain]);

  return (
    <BlockchainContext.Provider
      value={{
        blockchain,
        miningQueue,
        castVote: (vote: VoteInfo) => {
          return castVote(vote, currentUser.privateKey);
        }
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
};