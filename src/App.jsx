import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import './styles/App.css';
import twitterLogo from './assets/twitter-logo.svg';
import contractABI from './utils/contractABI.json';
import polygonLogo from './assets/polygonlogo.png';
import ethLogo from './assets/ethlogo.png';
import { networks } from './utils/networks';

const TWITTER_HANDLE = 'AuraExchange';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
const tld = '.aura';
const CONTRACT_ADDRESS = '0xF71F3c30259db0Df3e27E462518941FFe6fe4238';

const App = () => {
	const [network, setNetwork] = useState('');
	const [currentAccount, setCurrentAccount] = useState('');
	const [domain, setDomain] = useState('');
	const [record, setRecord] = useState('');
	const [editing, setEditing] = useState(false);
	const [mints, setMints] = useState([]);

	const connectWallet = async () => {
		try {
			const { ethereum } = window;

			if (!ethereum) {
				alert("You need metamask");
				return;
			}

			const accounts = await ethereum.request({ method: "eth_requestAccounts" });

			console.log("Connected", accounts[0]);
			setCurrentAccount(accounts[0]);
		} catch (error) {
			console.log(error)
		}
	}

	const switchNetwork = async () => {
		if (window.ethereum) {
			try {
				// Try to switch to the Mumbai testnet
				await window.ethereum.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: '0x1' }], // Check networks.js for hexadecimal network ids
				});
			} catch (error) {
				// This error code means that the chain we want has not been added to MetaMask
				// In this case we ask the user to add it to their MetaMask
				if (error.code === 4902) {
					try {
						await window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{
									chainId: '0x1',
									chainName: 'Mainnet',
									rpcUrls: ['https://mainnet.infura.io/v3/895bccea06e74a139d53eee3e821b3ed/'],
									nativeCurrency: {
										name: "Mainnet",
										symbol: "ETH",
										decimals: 18
									},
									blockExplorerUrls: ["https://etherscan.io/"]
								},
							],
						});
					} catch (error) {
						console.log(error);
					}
				}
				console.log(error);
			}
		} else {
			// If window.ethereum is not found then MetaMask is not installed
			alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
		}
	}




	const checkIfWalletIsConnected = async () => {
		const { ethereum } = window;

		if (!ethereum) {
			console.log('Yes. You actually DO need metamask');
			return;
		} else {
			console.log('Ethereum Object Detected', ethereum);
		}

		const accounts = await ethereum.request({ method: 'eth_accounts' });

		if (accounts.length !== 0) {
			const account = accounts[0];
			console.log('Found account:', account);
			setCurrentAccount(account);
		} else {
			console.log('No account found');
		}

		const chainId = await ethereum.request({ method: 'eth_chainId' });
		setNetwork(networks[chainId]);

		ethereum.on('chainChanged', handleChainChanged);

		function handleChainChanged(_chainId) {
			window.location.reload();
		}
	};

	const mintDomain = async () => {
		if (!domain) { return }
		if (domain.length < 3) {
			alert('Domain must be 3 characters or longer');
			return;
		}

		const price = domain.length === 3 ? '0.05' : domain.length === 4 ? '0.02' : '0.01';
		console.log("Minting domain", domain, "with ", price);
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);

				console.log("Paying gas")
				let tx = await contract.register(domain, { value: ethers.utils.parseEther(price) });
				const receipt = await tx.wait();
				if (receipt.status === 1) {
					console.log("Domain minted! transaction hash:  https://etherscan.io/tx/" + tx.hash);

					tx = contract.setRecord(domain, record);
					await tx.wait();

					console.log("Record set! https://etherscan.io/tx/" + tx.hash);

					setRecord('');
					setDomain('');
				}
				else {
					alert("Transaction failed!");
				}
			}
		}
		catch (error) {
			console.log(error);
		}
	}

	const updateDomain = async () => {
		if (!record || !domain) { return }
		setLoading(true);
		console.log("Updating domain", domain, "with record", record);
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
				let tx = await contract.setRecord(domain, record);
				await tx.wait();
				console.log("Record set https://etherscan.io/tx/" + tx.hash);

				fetchMints();
				setRecord('');
				setDomain('');
			}
		} catch (error) {
			console.log(error);
		}
		setLoading(false);
	}
	const fetchMints = async () => {
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
				const names = await contract.getAllNames();
				const mintRecords = await Promise.all(names.map(async (name) => {
					const mintRecord = await contract.records(name);
					const owner = await contract.domains(name);
					return {
						id: names.indexOf(name),
						name: name,
						record: mintRecord,
						owner: owner,
					};
				}));
				console.log("MINTS FETCHED ", mintRecords);
				setMints(mintRecords);
			}
		} catch (error) {
			console.log(error);
		}
	}
	useEffect(() => {
		if (network === 'Ethereum Mainnet') {
			fetchMints();
		}
	}, [currentAccount, network]);

	// Render methods
	const renderNotConnectedContainer = () => (
		<div className="connect-wallet-container">
			<img src="https://ipfs.filebase.io/ipfs/QmYqHrqpEaiNNyLBM5hofqaaQs9fnGn35rVLz8L3Xqj45a" alt="Aura Domain Service" />
			<button onClick={connectWallet} className="cta-button connect-wallet-button">
				Connect Metamask
			</button>
		</div>
	);
	const renderMints = () => {
		if (currentAccount && mints.length > 0) {
			return (
				<div className="mint-container">
					<p className="subtitle"> Newly minted domains!</p>
					<div className="mint-list">
						{mints.map((mint, index) => {
							return (
								<div className="mint-item" key={index}>
									<div className='mint-row'>
										<a className="link" href={`https://opensea.io/assets/ethereum/${CONTRACT_ADDRESS}/${mint.id}`} target="_blank" rel="noopener noreferrer">
											<p className="underlined">{' '}{mint.name}{tld}{' '}</p>
										</a>
										{mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
											<button className="edit-button" onClick={() => editRecord(mint.name)}>
												<img className="edit-icon" src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" />
											</button>
											:
											null
										}
									</div>
									<p> {mint.record} </p>
								</div>)
						})}
					</div>
				</div>);
		}
	};
	const editRecord = (name) => {
		console.log("Editing record for:", name);
		setEditing(true);
		setDomain(name);
	}
	const renderInputForm = () => {
		if (network !== 'Mainnet') {
			return (
				<div className="connect-wallet-container">
					<p>Please connect to Ethereum Mainnet</p>
					<button className='cta-button mint-button' onClick={switchNetwork}>Click here to switch</button>
				</div>
			);
		}

		return (
			<div className="form-container">
				<div className="first-row">
					<input
						type="text"
						value={domain}
						placeholder='domain'
						onChange={e => setDomain(e.target.value)}
					/>
					<p className='tld'> {tld} </p>
				</div>
				<input
					type="text"
					value={record}
					placeholder='twitter handle'
					onChange={e => setRecord(e.target.value)} />
				{editing ? (
					<div className="button-container">
							// This will call updateDomain function
						<button className='cta-button mint-button' onClick={updateDomain}>
							Set record
						</button>
							// This will let user out of editing mode
						<button className='cta-button mint-button' onClick={() => { setEditing(false) }}>
							Cancel
						</button>
					</div>
				) : (
					<button className='cta-button mint-button' onClick={mintDomain}>
						Mint
					</button>
				)}
			</div>
		);
	}


	useEffect(() => {
		checkIfWalletIsConnected();
	}, []);

	return (
		<div className="App">
			<div className="header-container">
				<header>
					<div className="center">
						<p className="title">Aura Domain Service</p>
						<p className="subtitle">A utility of Aura HUB</p>
					</div>
					<div className="right">
						<img alt="Network logo" className="logo" src={network.includes("Mainnet") ? polygonLogo : ethLogo} />
						{currentAccount ? <p> Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)} </p> : <p> Not connected </p>}
					</div>
				</header>
			</div>

			{!currentAccount && renderNotConnectedContainer()}
			{currentAccount && renderInputForm()}
			{mints && renderMints()}

			<div className="footer-container">
				<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
				<a
					className="footer-text"
					href={TWITTER_LINK}
					target="_blank"
					rel="noreferrer"
				>{`A utility of @${TWITTER_HANDLE}`}</a>
			</div>
		</div>
	);
};

export default App;