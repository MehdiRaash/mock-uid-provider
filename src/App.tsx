import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { web3Enable, web3Accounts, web3AccountsSubscribe } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';
import schema from './polymesh_schema.json';
import { hexToU8a } from '@polkadot/util';
import { stringify as uuidStringify } from 'uuid';
import { networkURLs } from './constants';

function App() {
  const [polyWallet, setPolyWallet] = useState<any>(null);
  const [proof, setProof] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [api, setApi] = useState<ApiPromise | undefined>();
  const [did, setDid] = useState<string | undefined>();
  const [network, setNetwork] = useState<string | undefined>();
  const [error, setInternalError] = useState<Error | undefined>();
  const [ticker, setTicker] = useState<string>('')

  const setError = (error: Error, disappear: boolean = false) => {
    setInternalError(error);
    disappear && setTimeout(() => setInternalError(undefined), 3000);
  }

  useEffect(() => {
    if (api && !polyWallet) {
      web3Enable('PME Mock CDD Provider').then((exts) => {
        const wallet = exts.filter(ext => ext.name === 'polywallet')[0]
        if (!wallet) {
          setError(new Error(`Please install Polymesh wallet extension from Chrome store`));
          return;
        }

        setPolyWallet(wallet);

        // @ts-ignore
        wallet.network.subscribe(() => window.location.reload());

        // @ts-ignore
        wallet.network.get().then(network => setNetwork(network.name));

        web3AccountsSubscribe(() => {
          window.location.reload();
        });

        web3Accounts().then((accounts) => {
          if (!accounts.length) {
            setError(new Error('No accounts found in wallet extension'));
            return;
          }

          console.log('>>> AccountId', accounts[0].address)
          setAddress(accounts[0].address);

          api.query.identity.keyToIdentityIds(accounts[0].address).then((linkedKeyInfo) => {
            if (!linkedKeyInfo.isEmpty) {
              setDid(linkedKeyInfo.toString());
            }
          })
        })
      });
    }
  }, [api, polyWallet]);

  useEffect(() => {
    if (!api && network) {
      const provider = new WsProvider(networkURLs[network]);
      const apiPromise = new ApiPromise({
        provider,
        types: schema.types,
        rpc: schema.rpc
      });
      apiPromise.isReady.then((api) => {
        console.log('>>> Api', api);
        setApi(api);
      });
    }
  }, [ api, network ])

  const generateProof = (polyWallet: any) => {
    if (!ticker.length) {
      setError(new Error('"Ticker" is required'), true);
      return;
    }
    polyWallet.uid.requestProof({ticker })
      .then((data: any) => {
        console.log('Data', data);
        setProof(data.proof);
      }, setError)
      .catch(setError);
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    setTicker(event.target.value);
  }

  const provideUid = async (polyWallet: any, address: string, did: string) => {
    console.log('Generating uID...');
    const crypto = await import('pkg')
    const mockUIdHex = `0x${crypto.process_create_mocked_investor_uid(did)}`;
    const uid = uuidStringify(hexToU8a(mockUIdHex));

    console.log('>>> uid', uid);

    polyWallet.uid.provide({
      address,
      uid,
      did,
      network
    }).then(console.log, setError).catch(setError);
  }

  const Body = () => {
    if (polyWallet && api) {
      return (
        <>
          <p>
            Network: {network || 'unknown'}
          </p>
          <p>
            User address: {address || 'unknown'}
          </p>
          <p>
            DID: {did || 'none'}
          </p>
          { did && <button  onClick={() => provideUid(polyWallet, address, did)}>
            Generate a dummy uID and import it to Polymesh wallet
            </button> }<br />
          <p>
            <input name='ticker' value={ticker} type='text' onChange={handleChange} />
            <button onClick={() => generateProof(polyWallet)}>Use stored uID to generate proof</button>
          </p>
          { proof && <span>Proof: {JSON.stringify(proof, null, 3)} </span> }
          { error && <span>{error.message}</span>}
        </>
      )
    }
    else if (error) {
      return <span>{error.message}</span>
    }
    return <div>Initalizing API instance ...</div>;
  }

    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <Body />
        </header>
      </div> 
    );
  
}

export default App;