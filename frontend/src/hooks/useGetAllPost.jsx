import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetAllPost = () => {
    const { setPosts } = useApp();
    useEffect(() => {
        let isCurrent = true;
        const fetchAllPost = async () => {
            try {
                const res = await api.get('/api/v1/post/all');
                if (isCurrent && res.data?.success) { 
                    setPosts(res.data.posts);
                }
            } catch (error) {
                if (isCurrent) console.log(error);
            }
        };
        fetchAllPost();
        return () => {
            isCurrent = false;
        };
    }, []);
};
export default useGetAllPost;
