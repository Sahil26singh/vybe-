import { useApp } from "@/context/AppContext";
import api, { API_URL } from "@/lib/axios";
import { useEffect } from "react";

const useGetAllMessage = () => {
    const { selectedUser, setMessages } = useApp();
    useEffect(() => {
        const fetchAllMessage = async () => {
            if (!selectedUser?._id) return;
            try {
                const res = await api.get(`${API_URL}/api/v1/message/all/${selectedUser?._id}`, { withCredentials: true });
                if (res.data.success) {  
                    setMessages(res.data.messages);
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchAllMessage();
    }, [selectedUser]);
};
export default useGetAllMessage;