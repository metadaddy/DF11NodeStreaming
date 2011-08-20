public with sharing class ChatController {
    private String profileImageUrl = [SELECT SmallPhotoUrl 
                    FROM User 
                    WHERE ID = :UserInfo.getUserId()].smallPhotoUrl;

    private String nickname = [SELECT CommunityNickname 
                    FROM User 
                    WHERE id = :UserInfo.getUserId()].communityNickname;

    public String getNickname() {
        return nickname;
    }     

    public String getProfileImageUrl() {
        return profileImageUrl;
    }     

    public String text { get; set; }

    public List<Message__c> getMessages() {
        return [SELECT sender__c, text__c, source__c
                FROM Message__c 
                ORDER BY timestamp__c DESC 
                LIMIT 10];
    }


    public PageReference send() {
        if ( text.length() > 0 ) {
            insert new Message__c(sender__c = nickname, text__c = text, source__c = 'internal');
            
            text = '';
        }
            
        return null;
    }


    public PageReference join() {
        insert new Message__c(text__c = nickname + ' has joined', source__c = 'internal');
        
        return null;  
    }
    
    public PageReference leave() {
        insert new Message__c(text__c = nickname + ' has left', source__c = 'internal');
        
        return null;  
    }
}