import axios from "axios"

// Spec: https://www.notion.so/proofofemail/Email-Sender-Auth-c87063cd6cdc4c5987ea3bc881c68813#d7407d31e1354167be61612f5a16995b
// TODO Consider using a bigint for templateIdx as it *could* overflow JS number, but practically seems unlikely
type RequestIDData = {
	request_id: number;
}

class Relayer {
    private readonly apiRoute = 'api';
    apiUrl: string;

    constructor(relayerUrl: string) {
        this.apiUrl = `${relayerUrl}${this.apiRoute}`
    }

    // Similar to a ping or health endpoint
    async echo() {
        const res = await axios({
			method: 'GET',
			url: `${this.apiUrl}/echo`
		})
		return res.data;
    }

    async requestStatus(requestId: number) {
		// TODO type res body
        const { data } = await axios({
			method: 'GET',
			url: `${this.apiUrl}/requestStatus`,
			data: {
				request_id: requestId
			}
		})
		return data;
    }

    async acceptanceRequest(
		walletEthAddr: string,
		guardianEmailAddr: string,
		accountCode: string,
		templateIdx: number,
		subject: string
	): Promise<{ requestId: number }> {
		const { data } = await axios({
			method: "POST",
			url: `${this.apiUrl}/acceptanceRequest`,
			data: {
				wallet_eth_addr: walletEthAddr,
				guardian_email_addr: guardianEmailAddr,
				account_code: accountCode,
				template_idx: templateIdx,
				subject,
			}
		})
		const { request_id: requestId } = data;
		return { requestId };
    }

    async recoveryRequest(
		walletEthAddr: string,
		guardianEmailAddr: string,
		templateIdx: number,
		subject: string
	) {
		const {
			request_id: requestId 
		} = await axios<unknown, RequestIDData>({
			method: "POST",
			url: `${this.apiUrl}/recoveryRequest`,
			data: {
				wallet_eth_addr: walletEthAddr,
				guardian_email_addr: guardianEmailAddr,
				template_idx: templateIdx,
				subject,
			}
		})
		return { requestId };
    }

    async completeRequest(walletEthAddr: string) {
		const data = await axios<unknown, unknown>({
			method: "POST",
			url: `${this.apiUrl}/completeRequest`,
			data: {
				wallet_eth_addr: walletEthAddr,
			}
		})
		return data;
    }
}

export const relayer = new Relayer(import.meta.env.VITE_RELAYER_URL);
