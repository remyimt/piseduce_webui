### Mots de passe
* wifi piseduce_cluster: piseduceCONFIG
* SSH sur le raspAP (hotspot wifi) : pi / raspberry
* SSH sur le pimaster : root / piseduceadmin

### Copy des images sur les cartes SD
* Copier l'image *piseduce-16-feb-2021.img* sur une carte SD
```
sudo dd if=piseduce-16-feb-2021.img of=/dev/sdb bs=4M conv=fsync
sync
sudo umount /dev/sdb1 /dev/sdb2
```
* Copier l'image *raspAP-10-fev-2021.img* sur une carte SD
```
sudo dd if=raspAP-10-fev-2021.img of=/dev/sdb bs=4M conv=fsync
sync
sudo umount /dev/sdb1 /dev/sdb2
```

### Câblage
* IMPORTANT: Brancher le Raspberry piseduce (pimaster) sur le **premier** port du switch
* Brancher le Raspberry raspAP sur un autre port
* Vérifier que les 2 Raspberry sont bien alimentés (le diode rouge doit être allumée)

### Configuration en SSH du pimaster
#### Connexion au wifi du raspAP
* Se connecter au WIFI *piseduce_cluster* (mdp : piseduceCONFIG)

#### Configuration de la connexion WIFI
* Se connecter au pimaster (mdp : piseduceadmin)
```
ssh root@48.48.0.254
```
* Selection du pays avec l'outil *raspi-config*
```
raspi-config
Localisation Options > WLAN Country > FR
Finish
Reboot > No
```
* Éditer */etc/wpa_supplicant/wpa_supplicant.conf* et ajouter :
* **ATTENTION**: ne pas mettre d'espace avant ou après les '='
```
network={
  ssid="monWifi"
  psk="monMDP"
}
```
* Connexion au WIFI : `wpa_cli -i wlan0 reconfigure`
  * Si la commande retourne *Failed to connect to non-global ctrl_ifname: wlan0*, redémarrer le raspberry : `reboot`
* Noter l'adresse IP de l'interface wlan0 : `ip a` (ici, *192.168.77.68*)

### Connexion au PiSeduce resource manager
* Débrancher le Raspberry raspAP
* Sur le poste client, ajouter la route pour accèder au cluster en passant par le pimaster
  * Ubuntu
```
sudo ip route add 48.48.0.0/24 via 192.168.77.68
```
  * MacOS
```
sudo route add -net 48.48.0.0/24 gw 192.168.77.68
```
* Tester la connexion au cluster
```
ping 48.48.0.254
```
* Se connecter au PiMaster *http://192.168.77.68:9000* avec le compte admin : admin@piseduce.fr / piseduceadmin

#### Configuration du PiSeduce resource manager
* Ajout de l'agent s'exécutant sur le pimaster
  * Depuis le menu principal (en gris foncé sur la gauche de la page), cliquer '(Admin) Worker'
  * Dans 'Add Worker', remplir le formulaire avec les valeurs suivantes :
  ```
  name: LocalAgent48
  ip: localhost
  port: 8090
  token: 12345678912345678912
  ```
  * Cliquer sur Add. Le worker 'LocalAgent' doit apparaître dans 'Existing Workers'
* Affectation d'une IP au switch
  * Depuis le menu principal (en gris foncé sur la gauche de la page), cliquer '(Admin) DHCP Clients'
  * Dans 'Add Client', remplir le formulaire avec les valeurs suivantes :
  ```
  name: main_switch
  ip: 48.48.0.252
  mac_address:	La MAC du switch est inscrite sur le switch.
  		Il est probable que la MAC soit aussi présente dans le fichier '/var/log/syslog' avec un message 'no address available'.
  ```
* Attendre que la LED bleue du switch arrête de clignoter puis tester la connexion au switch : `ping 48.48.0.252`
* Configurer le SNMP du switch en se connectant à l'adresse http://48.48.0.252 (admin / admin)
```
System Management > SNMP > Feature Configuration > SNMP: Enable > Apply
System Management > SNMP > Communities > Add
SNMP Management Station: All ; Community: piseduce ; Access Mode: Read Write ; Apply
Maintenance > File Management > Configuration File Copy > Apply
```
* Ajout du switch
  * Depuis le menu principal (en gris foncé sur la gauche de la page), cliquer '(Admin) Switch'
  * Dans 'Add Switch', remplir le formulaire avec les valeurs suivantes :
  ```
  name: main_switch
  ip: 48.48.0.252
  community: piseduce
  master_port: 1
  oid_first_port: 1.3.6.1.2.1.105.1.1.1.3.1.49 (pour un switch Linksys LGS308P)
  ```
  * Cliquer sur Add. Le switch 'main_switch' doit apparaître dans 'Existing Switchs'
* Vérification des informations du switch
  * Vérifier que le nombre de ports est correct. Si ce n'est pas le cas, la valeur 'oid_first_port' n'est pas bonne.
* Tester la connexion au switch
  * Dans 'Switch Management', sélectionner 'main_switch' pour 'Select the switch to manage'
  * Au lieu de l'action 'Turn On Ports', sélectionner l'action 'Port Status'
  * Cliquer sur le bouton 'Execute' et attendre quelques secondes
  * Des couleurs vertes (pour les ports allumés) et rouges (pour les ports éteints) doivent apparaître assez rapidement (< 1min).
* Ajout des noeuds
  * Toujours dans la section 'Switch Management' avec le switch 'main_switch' de sélectionner
  * Sélectionner un port libre en cochant la case associée au port
  * Sélectionner l'opération 'Detect Nodes'
  * Cliquer sur le bouton 'Execute'. Une fenêtre s'ouvre en dessous du switch pour suivre l'action de détection des noeuds.
  * **IMPORTANT**: Il ne faut pas quitter la page pendant la détection (pas de rafraichissement, pas de clic avec la souris)
* Ajout de l'environnement de déploiement (l'image disque associée à cet environement est '/root/environments/2020-08-20-raspios-buster-armhf-lite.img.tar.gz')
  * Depuis le menu principal (en gris foncé sur la gauche de la page), cliquer '(Admin) Environment'
  * Dans 'Add Environment', remplir le formulaire avec les valeurs suivantes :
  ```
  desc: buster (la propriété est buggée pour le moment)
  img_name: 2020-08-20-raspios-buster-armhf-lite.img.tar.gz (nom du fichier)
  img_size: 1849688064 (taille de l'image décompressée pour afficher la barre de téléversement)
  name: raspbian_buster_32bit (nom de l'environnement pour les utilisateurs)
  sector_start: 532480 (numéro du premier secteur de la seconde partition)
  ssh_user: root (utilisateur pour les connexions SSH sur l'environnement déployé)
  type: default (pas utilisé pour l'instant)
  web: false (si une interface web est fournie par l'environnement)
  ```
