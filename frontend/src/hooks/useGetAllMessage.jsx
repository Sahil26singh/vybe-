import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetAllMessage = () => {
    const { selectedUser, setMessages } = useApp();
    useEffect(() => {
        let isCurrent = true;
        const fetchAllMessage = async () => {
            if (!selectedUser?._id) return;
            try {
                const res = await api.get(`/api/v1/message/all/${selectedUser._id}`);
                if (isCurrent && res.data?.success) {  
                    setMessages(res.data.messages);
                }
            } catch (error) {
                if (isCurrent) console.log(error);
            }
        };
        fetchAllMessage();
        return () => {
            isCurrent = false;
        };
    }, [selectedUser?._id]);
};
export default useGetAllMessage;
