<?php
    require_once ('../Force.com-Toolkit-for-PHP/soapclient/SforcePartnerClient.php');

    define("USERNAME", "streaming@df11.pat");
    define("PASSWORD", "iPl4net!");
	define("SECURITY_TOKEN", "");

    $mySforceConnection = new SforcePartnerClient();
    $mySforceConnection->createConnection("../Force.com-Toolkit-for-PHP/soapclient/partner.wsdl.xml");

    $mySforceConnection->login(USERNAME, PASSWORD.SECURITY_TOKEN);

    echo "Doing query\n";
    $query = "SELECT Id from Message__c";
    $qresponse = $mySforceConnection->query($query);

    echo $qresponse->size." records found.\n";

    // Delete in batches of 100
    for ($batch = 0; $batch < $qresponse->size; $batch += 100) {
        $end = min($qresponse->size, $batch + 100);
	    $ids = array();
	    for ($record = $batch; $record < $end; $record++) {
            array_push($ids, $qresponse->records[$record]->Id);
		}
			
	    $dresponse = $mySforceConnection->delete($ids);

	    $deleted = 0;
			foreach ($dresponse as $result) {
	        if ($result->success == 1) {
				$deleted++;
			} else {
				echo "Error: ".$result->errors->message."\n";
			}
	    }

		echo $deleted." records deleted.\n";
	}
?>